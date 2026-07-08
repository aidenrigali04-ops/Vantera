import { describeViolations, type ReplyVerdict } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import type { InboundDeps, InboundPayload, InboundStore, InboundSummary } from "./types";

/**
 * Hard-negative classifications terminate outbound. Both also write suppression (rule 11), so
 * the lead can never be contacted again on LinkedIn. Every OTHER genuine reply (interested /
 * neutral / other) keeps the sequence nurturing toward close — a reply alone is not a stop signal.
 */
const STOPS_SEQUENCE = new Set<ReplyVerdict["classification"]>(["not_interested", "unsubscribe"]);

/**
 * Replies the responder actively answers. not_interested / unsubscribe stop (and suppress);
 * out_of_office never reaches here; a booked meeting is the win — we celebrate, we don't keep selling.
 */
const RESPONDABLE = new Set<ReplyVerdict["classification"]>(["interested", "neutral", "other"]);

/**
 * Converse-to-close turn cap. After this many agent messages in one thread without converting, the
 * responder goes quiet and leaves it to the human — automation should never pester a real prospect.
 */
const MAX_AGENT_TURNS = 6;

/**
 * Freshness window for auto-answering. A reply processed days after it arrived (webhook outage
 * replay, backfill) is still classified + notified, but answering it reads as a bot waking up —
 * the human decides whether that thread is worth reviving.
 */
export const RESPOND_MAX_REPLY_AGE_MS = 72 * 3_600_000;

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
 * The ACTIVE responder: understand the lead's message and draft the seller's next move with the
 * SAME grounding + humanizer as the outreach copy, then queue it as a message-stage send so the
 * existing dispatch path delivers it (paced, suppression-checked, from the locked sender). In
 * 'automatic' mode a clean reply auto-sends; in 'review' mode — or if the humanizer flags it — it
 * waits in the review queue. Returns true if a reply was drafted + queued.
 *
 * The contextual reply SUPERSEDES any queued scripted touch for the lead: once the prospect engages,
 * the conversation is driven by what they actually said, not the pre-written sequence — and it keeps
 * going each time they reply until they book, opt out, or the turn cap is hit ("converse to close").
 */
async function maybeRespond(
  deps: InboundDeps,
  accountId: string,
  lead: { id: string; campaignId: string | null },
  incoming: string,
  verdict: ReplyVerdict,
  receivedAt: Date,
  now: Date
): Promise<boolean> {
  if (!deps.respondFn) return false;
  if (!RESPONDABLE.has(verdict.classification) || verdict.booked) return false;
  // Stale reply (replay/backfill artifact) — never auto-answer days later.
  if (now.getTime() - receivedAt.getTime() > RESPOND_MAX_REPLY_AGE_MS) return false;

  const bundle = await deps.store.getResponderBundle(accountId, lead.id, lead.campaignId);
  if (!bundle) return false; // no live Outreach agent, or no insights to ground a reply
  if (bundle.agentTurns >= MAX_AGENT_TURNS) return false; // hand off to the human
  // A queued message NEWER than this reply is (or already covers) the answer — don't double-
  // message. An OLDER one was drafted blind to what the lead just said: fall through and let
  // cancelPendingSends below supersede it (a blind scripted draft used to both block this
  // response AND later send as a tone-deaf duplicate).
  if (
    bundle.newestUnsentMessageCreatedAt !== null &&
    bundle.newestUnsentMessageCreatedAt > receivedAt
  ) {
    return false;
  }

  const respondInput = {
    lead: bundle.lead,
    insights: bundle.insights,
    context: bundle.context,
    thread: bundle.thread,
    incoming,
    classification: verdict.classification,
  };
  let reply = await deps.respondFn(respondInput);
  // Automatic senders get ONE targeted fix of a flagged reply before it may auto-send; the fix is
  // re-linted with the same bar, so a still-flagged result falls through to review below.
  if (bundle.sendMode === "automatic" && reply.violations.length > 0 && deps.fixReplyFn) {
    reply = await deps.fixReplyFn(reply, respondInput);
  }
  const clean = reply.violations.length === 0;
  const autoSend = bundle.sendMode === "automatic" && clean;

  // Replace any queued scripted touch — the contextual reply takes over the conversation.
  await deps.store.cancelPendingSends(lead.id);
  await deps.store.insertScheduledSend({
    accountId,
    campaignId: bundle.campaignId,
    leadId: lead.id,
    channel: "linkedin",
    subject: null,
    body: reply.message,
    status: autoSend ? "approved" : "pending_review",
    linkedinStage: "message",
    styleFlags: clean ? null : describeViolations(reply.violations),
  });
  return true;
}

/**
 * Match an inbound event to a lead, layered by identity strength (found 2026-07-05: Unipile
 * identifies people by member provider_id, NOT the vanity URL discovery stores — URL-only
 * matching left every reply at "no matching lead" and analytics at 0 replied):
 *
 *   1. provider_id (0043 column, captured at send time) — the reliable key
 *   2. profile URL as sent (matches leads whose stored URL is already the /in/<id> form)
 *   3. public vanity slug, when the payload happens to carry one
 *   4. exact-unique display-name among contacted leads — last resort, only when unambiguous
 *
 * Any successful match BACKFILLS the provider ref, so leads contacted before 0043 self-heal
 * on their first inbound event and match by the strong key forever after.
 */
async function matchLead(
  store: InboundDeps["store"],
  accountId: string,
  who: { profileUrl: string; providerRef: string | null; publicIdentifier: string | null; name: string | null }
): Promise<{ id: string; campaignId: string | null } | null> {
  let lead: { id: string; campaignId: string | null } | null = null;

  if (who.providerRef) lead = await store.findLeadByProviderRef(accountId, who.providerRef);
  if (!lead) lead = await store.findLeadByLinkedInUrl(accountId, normalizeLinkedInUrl(who.profileUrl));
  if (!lead && who.publicIdentifier) {
    lead = await store.findLeadByLinkedInUrl(
      accountId,
      normalizeLinkedInUrl(`https://www.linkedin.com/in/${who.publicIdentifier}`)
    );
  }
  if (!lead && who.name) {
    const byName = await store.findContactedLeadsByName(accountId, who.name);
    if (byName.length === 1) lead = byName[0]!;
  }

  if (lead && who.providerRef) await store.saveLeadProviderRef(lead.id, who.providerRef);
  return lead;
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
    const { supersededRefs } = await deps.store.upsertLinkedInAccountStatus({
      vanteraAccountId: event.vanteraAccountId,
      providerRef: event.connectedAccountRef,
      status: event.status,
      profileUrl: event.profileUrl,
      displayName: event.displayName,
    });
    // A reconnect under a fresh provider account superseded the old connection(s):
    // delete them provider-side so the tenant never pays for a seat we no longer use.
    // Best-effort — the account-health sweep is the janitor for anything missed.
    for (const ref of supersededRefs) {
      try {
        await deps.linkedinInfra.deleteConnectedAccount(ref);
      } catch {
        /* swept later */
      }
    }
    return {
      handled: true,
      action: `account:${event.status}${supersededRefs.length > 0 ? "+merged" : ""}`,
    };
  }

  const identity = await deps.store.findLinkedInAccountByProviderRef(event.connectedAccountRef);
  if (!identity) return { handled: false, action: "unknown linkedin identity" };
  const { accountId } = identity;

  if (event.type === "relationship_accepted") {
    const lead = await matchLead(deps.store, accountId, {
      profileUrl: event.profileUrl,
      providerRef: event.fromProviderRef,
      publicIdentifier: event.fromPublicIdentifier,
      name: event.fromName,
    });
    if (!lead) return { handled: false, action: "no matching lead" };
    await deps.store.setLeadConnected(lead.id, now);
    return { handled: true, action: "relationship_accepted" };
  }

  // LinkedIn reply — explicit narrow so a future event variant can't fall into the reply path
  if (event.type !== "reply") return { handled: false, action: "unhandled event type" };
  const url = normalizeLinkedInUrl(event.fromProfileUrl);
  const lead = await matchLead(deps.store, accountId, {
    profileUrl: event.fromProfileUrl,
    providerRef: event.fromProviderRef,
    publicIdentifier: event.fromPublicIdentifier,
    name: event.fromName,
  });
  if (!lead) return { handled: false, action: "no matching lead" };
  // provider_message_ref makes the insert idempotent (0043 partial unique index) — provider
  // retries and the stored-event replay can never double-count a reply.
  const inserted = await deps.store.insertReply({
    accountId,
    leadId: lead.id,
    campaignId: lead.campaignId,
    channel: "linkedin",
    providerMessageRef: event.providerEventId,
    body: event.body,
    receivedAt: new Date(event.receivedAt),
  });
  if (!inserted.created) return { handled: true, action: "reply:duplicate" };
  const replyId = inserted.id;
  const verdict = await deps.classifyFn(event.body);
  await deps.store.setReplyClassification(replyId, verdict);
  if (verdict.classification !== "out_of_office") {
    await applyGenuineReply(deps.store, accountId, lead, verdict, now);
  }
  if (verdict.classification === "not_interested") {
    await deps.store.addSuppression(accountId, "linkedin", url, "not_interested", lead.id);
    return { handled: true, action: "reply:not_interested" };
  }
  if (verdict.classification === "unsubscribe") {
    await deps.store.addSuppression(accountId, "linkedin", url, "unsubscribe", lead.id);
    return { handled: true, action: "reply:unsubscribe" };
  }
  // Active responder: draft + queue the seller's next move, continuing the conversation toward close.
  const responded = await maybeRespond(
    deps, accountId, lead, event.body, verdict, new Date(event.receivedAt), now
  );
  return { handled: true, action: `reply:${verdict.classification}${responded ? "+responded" : ""}` };
}
