import { normalizeLinkedInUrl } from "./copy-draft";
import type { InboundDeps, InboundPayload, InboundSummary } from "./types";

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
          await deps.store.cancelPendingSends(lead.id);
          await deps.store.setLeadReplied(lead.id, lead.campaignId);
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

  // LinkedIn reply
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
    await deps.store.cancelPendingSends(lead.id);
    await deps.store.setLeadReplied(lead.id, lead.campaignId);
  }
  if (verdict.classification === "not_interested") {
    await deps.store.addSuppression(accountId, "linkedin", url, "not_interested", lead.id);
  } else if (verdict.classification === "unsubscribe") {
    await deps.store.addSuppression(accountId, "linkedin", url, "unsubscribe", lead.id);
  }
  return { handled: true, action: `reply:${verdict.classification}` };
}
