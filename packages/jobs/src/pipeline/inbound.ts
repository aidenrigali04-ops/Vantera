import type { ReplyVerdict } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import { normalizePhone } from "./call-brief";
import type { InboundDeps, InboundPayload, InboundStore, InboundSummary } from "./types";

/**
 * Hard-negative classifications terminate outbound. Both also write suppression (rule 11), so
 * the lead can never be contacted again on that channel. Every OTHER genuine reply (interested /
 * neutral / other) keeps the sequence nurturing toward close — a reply alone is not a stop signal.
 */
const STOPS_SEQUENCE = new Set<ReplyVerdict["classification"]>(["not_interested", "unsubscribe"]);

/**
 * Effects of a genuine (non-OOO) reply, shared across email / iMessage / LinkedIn. The lead is
 * always marked replied and the user is notified. The sequence is stopped — and its queued sends
 * canceled — ONLY on a hard-negative; otherwise outbound keeps running until the lead converts
 * (conversion gate) or is exhausted, because Vantera has no inbox for a human to take over.
 */
async function applyGenuineReply(
  store: InboundStore,
  accountId: string,
  lead: { id: string; campaignId: string | null },
  verdict: ReplyVerdict
): Promise<void> {
  await store.setLeadReplied(lead.id, lead.campaignId);
  if (STOPS_SEQUENCE.has(verdict.classification)) {
    await store.cancelPendingSends(lead.id);
    await store.stopSequenceForReply(lead.id);
  }
  await store.insertLeadNotification({
    accountId,
    leadId: lead.id,
    kind: "reply",
    body: `${lead.id} replied${verdict.classification === "not_interested" ? " (not interested)" : ""}.`,
  });
}

/**
 * Routes one verified, deduped webhook event (rules 03/04/11). Replies are
 * classified BEFORE reactions so an out-of-office never kills the sequence;
 * not_interested / unsubscribe write suppression (entries never expire).
 */
export async function runInbound(payload: InboundPayload, deps: InboundDeps): Promise<InboundSummary> {
  const now = deps.now?.() ?? new Date();

  if (payload.source === "email") {
    const event = deps.emailInfra.parseEventWebhook(payload.payload);
    if (!event) return { handled: false, action: "unparseable" };
    const mailbox = await deps.store.findMailboxByProviderRef(event.mailboxRef);
    if (!mailbox) return { handled: false, action: "unknown mailbox" };
    const { accountId } = mailbox;

    switch (event.type) {
      case "reply": {
        const from = event.from.toLowerCase();
        const lead = await deps.store.findLeadByEmail(accountId, from);
        if (!lead) return { handled: false, action: "no matching lead" };
        const replyId = await deps.store.insertReply({
          accountId,
          leadId: lead.id,
          campaignId: lead.campaignId,
          channel: "email",
          providerMessageRef: event.messageRef,
          body: event.body,
          receivedAt: new Date(event.receivedAt),
        });
        const verdict = await deps.classifyFn(event.body);
        await deps.store.setReplyClassification(replyId, verdict);
        if (verdict.classification !== "out_of_office") {
          await applyGenuineReply(deps.store, accountId, lead, verdict);
        }
        if (verdict.classification === "not_interested") {
          await deps.store.addSuppression(accountId, "email", from, "not_interested", lead.id);
        } else if (verdict.classification === "unsubscribe") {
          await deps.store.addSuppression(accountId, "email", from, "unsubscribe", lead.id);
        }
        return { handled: true, action: `reply:${verdict.classification}` };
      }
      case "bounce":
      case "unsubscribe": {
        const recipient = event.recipient.toLowerCase();
        await deps.store.addSuppression(
          accountId,
          "email",
          recipient,
          event.type === "bounce" ? "bounce" : "unsubscribe"
        );
        const lead = await deps.store.findLeadByEmail(accountId, recipient);
        if (lead) await deps.store.cancelPendingSends(lead.id);
        return { handled: true, action: event.type };
      }
      case "complaint": {
        const recipient = event.recipient.toLowerCase();
        await deps.store.addSuppression(accountId, "email", recipient, "complaint");
        await deps.store.pauseMailbox(mailbox.id);
        const lead = await deps.store.findLeadByEmail(accountId, recipient);
        if (lead) await deps.store.cancelPendingSends(lead.id);
        return { handled: true, action: "complaint" };
      }
      case "warmup_update": {
        await deps.store.updateMailboxWarmup(
          mailbox.id,
          event.phase === "ready" ? "active" : "warming",
          event.dailyCap
        );
        return { handled: true, action: "warmup_update" };
      }
    }
  }

  // iMessage branch — tenant resolved globally by outbound history (provider carries no accountId)
  if (payload.source === "imessage") {
    const event = deps.messageInfra.parseEventWebhook(payload.payload);
    if (!event) return { handled: false, action: "unparseable" };

    if (event.type === "delivery") {
      return { handled: true, action: "delivery" };
    }

    // reply — look up lead+account globally by phone; the account that most recently
    // iMessaged this number owns the reply (disambiguates multi-tenant on a shared sender)
    const normalizedPhone = normalizePhone(event.fromPhone);
    const lead = await deps.store.findLeadByPhone(normalizedPhone);
    if (!lead) return { handled: false, action: "no matching lead" };
    const accountId = lead.accountId;
    const replyId = await deps.store.insertReply({
      accountId,
      leadId: lead.id,
      campaignId: lead.campaignId,
      channel: "imessage",
      providerMessageRef: event.providerMessageId,
      body: event.body,
      receivedAt: new Date(event.receivedAt),
    });
    const verdict = await deps.classifyFn(event.body);
    await deps.store.setReplyClassification(replyId, verdict);
    if (verdict.classification !== "out_of_office") {
      await applyGenuineReply(deps.store, accountId, lead, verdict);
    }
    if (verdict.classification === "not_interested") {
      await deps.store.addSuppression(accountId, "phone", normalizedPhone, "not_interested", lead.id);
    } else if (verdict.classification === "unsubscribe") {
      await deps.store.addSuppression(accountId, "phone", normalizedPhone, "unsubscribe", lead.id);
    }
    return { handled: true, action: `reply:${verdict.classification}` };
  }

  // LinkedIn branch
  const event = deps.linkedinInfra.parseEventWebhook(payload.payload);
  if (!event) return { handled: false, action: "unparseable" };

  if (event.type === "account_status") {
    if (!event.vanteraAccountId) return { handled: false, action: "account event without tenant" };
    await deps.store.upsertLinkedInAccountStatus({
      vanteraAccountId: event.vanteraAccountId,
      providerRef: event.connectedAccountRef,
      status: event.status,
      profileUrl: event.profileUrl,
      displayName: event.displayName,
    });
    return { handled: true, action: `account:${event.status}` };
  }

  const identity = await deps.store.findLinkedInAccountByProviderRef(event.connectedAccountRef);
  if (!identity) return { handled: false, action: "unknown linkedin identity" };
  const { accountId } = identity;

  if (event.type === "relationship_accepted") {
    const lead = await deps.store.findLeadByLinkedInUrl(
      accountId,
      normalizeLinkedInUrl(event.profileUrl)
    );
    if (!lead) return { handled: false, action: "no matching lead" };
    await deps.store.setLeadConnected(lead.id, now);
    return { handled: true, action: "relationship_accepted" };
  }

  // LinkedIn reply — explicit narrow so a future event variant can't fall into the reply path
  if (event.type !== "reply") return { handled: false, action: "unhandled event type" };
  const url = normalizeLinkedInUrl(event.fromProfileUrl);
  const lead = await deps.store.findLeadByLinkedInUrl(accountId, url);
  if (!lead) return { handled: false, action: "no matching lead" };
  const replyId = await deps.store.insertReply({
    accountId,
    leadId: lead.id,
    campaignId: lead.campaignId,
    channel: "linkedin",
    providerMessageRef: null,
    body: event.body,
    receivedAt: new Date(event.receivedAt),
  });
  const verdict = await deps.classifyFn(event.body);
  await deps.store.setReplyClassification(replyId, verdict);
  if (verdict.classification !== "out_of_office") {
    await applyGenuineReply(deps.store, accountId, lead, verdict);
  }
  if (verdict.classification === "not_interested") {
    await deps.store.addSuppression(accountId, "linkedin", url, "not_interested", lead.id);
  } else if (verdict.classification === "unsubscribe") {
    await deps.store.addSuppression(accountId, "linkedin", url, "unsubscribe", lead.id);
  }
  return { handled: true, action: `reply:${verdict.classification}` };
}
