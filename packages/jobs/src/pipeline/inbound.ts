import type { ReplyVerdict } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { InboundDeps, InboundPayload, InboundStore, InboundSummary } from "./types";

/**
 * Hard-negative classifications terminate outbound. Both also write suppression (rule 11), so
 * the lead can never be contacted again on LinkedIn. Every OTHER genuine reply (interested /
 * neutral / other) keeps the sequence nurturing toward close — a reply alone is not a stop signal.
 */
const STOPS_SEQUENCE = new Set<ReplyVerdict["classification"]>(["not_interested", "unsubscribe"]);

/**
 * Effects of a genuine (non-OOO) LinkedIn reply. The lead is always marked replied and the user
 * is notified. The sequence is stopped — and its queued sends canceled — ONLY on a hard-negative;
 * otherwise outbound keeps running until the lead converts (conversion gate) or is exhausted,
 * because Vantera has no inbox for a human to take over.
 */
async function applyGenuineReply(
  store: InboundStore,
  accountId: string,
  lead: { id: string; campaignId: string | null },
  verdict: ReplyVerdict,
  now: Date
): Promise<void> {
  await store.setLeadReplied(lead.id, lead.campaignId);
  if (STOPS_SEQUENCE.has(verdict.classification)) {
    await store.cancelPendingSends(lead.id);
    await store.stopSequenceForReply(lead.id);
  } else if (verdict.booked) {
    // A genuine reply confirming a scheduled meeting stamps meeting_booked_at — the
    // LinkedIn-native writer for the funnel's Meetings stage (the removed caller used to do this).
    await store.markMeetingBooked(lead.id, now);
  }
  await store.insertLeadNotification({
    accountId,
    leadId: lead.id,
    kind: "reply",
    body: `${lead.id} replied${verdict.classification === "not_interested" ? " (not interested)" : ""}.`,
  });
}

/**
 * Routes one verified, deduped LinkedIn webhook event (rules 04/11). Replies are
 * classified BEFORE reactions so an out-of-office never kills the sequence;
 * not_interested / unsubscribe write suppression (entries never expire).
 */
export async function runInbound(payload: InboundPayload, deps: InboundDeps): Promise<InboundSummary> {
  const now = deps.now?.() ?? new Date();

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
    await applyGenuineReply(deps.store, accountId, lead, verdict, now);
  }
  if (verdict.classification === "not_interested") {
    await deps.store.addSuppression(accountId, "linkedin", url, "not_interested", lead.id);
  } else if (verdict.classification === "unsubscribe") {
    await deps.store.addSuppression(accountId, "linkedin", url, "unsubscribe", lead.id);
  }
  return { handled: true, action: `reply:${verdict.classification}` };
}
