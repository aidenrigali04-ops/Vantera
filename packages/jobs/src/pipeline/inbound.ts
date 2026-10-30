import { tagLinksInText } from "@vantera/meetings-infra";
import {
  describeViolations,
  buildSendRecipe,
  RESPOND_SYSTEM,
  bestOfN,
  leadBlock,
  preClassify,
  DECLINE_CONFIDENCE,
  type Readout,
  type ReplyVerdict,
} from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
import type { LinkedInEvent } from "@vantera/linkedin-infra";
import { normalizeLinkedInUrl, MAX_BEST_OF_N } from "./copy-draft";
import { runConversationDecide, syncState, type DecideOutcome } from "./conversation-decide";
import type { InboundDeps, InboundPayload, InboundStore, InboundSummary, ResponderBundle } from "./types";

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
 * agent steps aside and HANDS OFF — the human is told to pick the thread up (needs_human), never
 * a silent stall. Shared with sequence-touch so proactive nudges respect the same ceiling.
 */
export const MAX_AGENT_TURNS = 6;

/** Conversation cadence (0044): after a prospect replies, the next proactive nudge (if they go
 *  quiet again) comes this many days after the last agent message — an engaged thread stays on
 *  a conversation clock instead of dying with the 2-touch cold sequence. */
export const CONVERSATION_NUDGE_GAP_DAYS = 2;
const DAY_MS = 86_400_000;

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
  now: Date,
  // legacy: the classifier's hard negatives stop; under conversation intelligence the readout decides
  stop: boolean = STOPS_SEQUENCE.has(verdict.classification)
): Promise<void> {
  await store.setLeadReplied(lead.id, lead.campaignId);
  if (stop) {
    await store.cancelPendingSends(lead.id);
    await store.stopSequenceForReply(lead.id);
  } else if (verdict.booked) {
    // A genuine reply confirming a scheduled meeting stamps meeting_booked_at — the
    // LinkedIn-native writer for the funnel's Meetings stage (the removed caller used to do this).
    await store.markMeetingBooked(lead.id, now);
    // Booking is an EVENT (L1, spec 2026-07-15): outreach stands down and the user is told
    // loudly. A prospect who just booked must never receive another scripted nudge — the
    // "keeps selling after I said yes" failure. The responder may still send its contextual
    // confirmation below; scheduled touches stop here.
    await store.cancelPendingSends(lead.id);
    await store.stopSequenceForReply(lead.id);
    await store.insertLeadNotification({
      accountId,
      leadId: lead.id,
      kind: "meeting_booked",
      body: verdict.classification,
    });
  }
  // body carries the machine-readable classification — the app layer maps it to honest
  // human copy (an interested reply and a not-interested one are different events).
  await store.insertLeadNotification({
    accountId,
    leadId: lead.id,
    kind: "reply",
    body: verdict.classification,
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
  incomingReply: { id: string; body: string; receivedAt: Date; ingestedAt: Date },
  verdict: ReplyVerdict,
  suppressionValues: string[],
  now: Date
): Promise<boolean> {
  const respondFn = deps.respondFn;
  if (!respondFn) return false;
  if (!RESPONDABLE.has(verdict.classification) || verdict.booked) return false;
  // Stale reply (replay/backfill artifact) — never auto-answer days later.
  if (now.getTime() - incomingReply.receivedAt.getTime() > RESPOND_MAX_REPLY_AGE_MS) return false;
  // Rule 11: suppression is checked before anything that could reach a prospect — the stored URL
  // send paths compare against, plus the payload URL. Dispatch re-checks; this keeps the queue clean.
  for (const value of suppressionValues) {
    if (await deps.store.isSuppressed(accountId, "linkedin", value)) return false;
  }
  const incoming = incomingReply.body;

  // The incoming reply is passed as `incoming` — excluded from the thread so it isn't seen twice.
  const bundle = await deps.store.getResponderBundle(accountId, lead.id, lead.campaignId, {
    excludeReplyId: incomingReply.id,
  });
  if (!bundle) return false; // no live Outreach agent, or no insights to ground a reply
  // A human took this thread over (replied manually → paused_reply). Stand down silently — the
  // person is driving now, and the reply notification above already told them a reply came in.
  // Sending on top of a human reply is the "bot re-pitches after I answered" failure (Mohamed K,
  // 2026-07-05). No turn-cap needs_human note here: that's for capped BOT threads, not human ones.
  if (bundle.humanHandled) return false;
  if (bundle.agentTurns >= MAX_AGENT_TURNS) {
    // Turn cap reached and a real prospect is still talking — the human must take over,
    // loudly (a capped thread used to just go silent).
    await deps.store.insertLeadNotification({
      accountId,
      leadId: lead.id,
      kind: "needs_human",
      body: "The agent hit its conversation limit on this thread — reply personally from the lead's page.",
    });
    // L3: the handoff is the third moment worth an email — a live prospect is waiting on a human.
    try {
      await deps.notifyLeadEvent?.({ kind: "needs_human", accountId, leadId: lead.id, snippet: incoming });
    } catch {
      // best-effort by design
    }
    return false;
  }
  // A queued message NEWER than this reply is (or already covers) the answer — don't double-
  // message. An OLDER one was drafted blind to what the lead just said: fall through and let
  // cancelPendingSends below supersede it (a blind scripted draft used to both block this
  // response AND later send as a tone-deaf duplicate). "Newer" is judged on OUR clock — the
  // reply row's ingestion time — never the provider's send time: a draft made while the webhook
  // was in flight postdates the provider timestamp yet never saw the reply.
  if (
    bundle.newestUnsentMessageCreatedAt !== null &&
    bundle.newestUnsentMessageCreatedAt > incomingReply.ingestedAt
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
  // Best-of-N (Phase 2C fast-follow, extending Task 3 to the responder path): absent judgeFn
  // forces n=1 regardless of config — no point drafting N candidates with nothing to rank them.
  // n<=1 is byte-identical to today (respondFn runs exactly once, the judge never runs), which
  // is how the feature stays fully OFF by default. The winner — chosen or not — flows through
  // the UNCHANGED humanizer/fixReplyFn gate below; the judge only ranks among candidates, it
  // never bypasses that gate (anti-Goodhart: the humanizer stays the hard floor). Grounding is
  // the SAME leadBlock the respond brain builds from this input (and the humanizer lints
  // against) — the judge never scores against an invented grounding string.
  const configuredN = Math.min(Math.max(1, Math.floor(deps.bestOfN ?? 1)), MAX_BEST_OF_N);
  const n = deps.judgeFn ? configuredN : 1;
  const { chosen } = await bestOfN(
    n,
    () => respondFn(respondInput),
    (d) => d.message,
    { grounding: leadBlock(respondInput), cta: respondInput.context.cta },
    deps.judgeFn
  );
  let reply = chosen;
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
    // ML-6: the seller's booking link carries this lead's tag, so a booking made from it attributes
    // to the exact lead (the brain writes the clean link; we tag the final text deterministically)
    body: tagLinksInText(reply.message, bundle.context.bookingUrl, lead.id),
    status: autoSend ? "approved" : "pending_review",
    linkedinStage: "message",
    origin: "reply_response", // rides the dispatch speed-to-lead lane (0044)
    styleFlags: clean ? null : describeViolations(reply.violations),
    // Stage 1: conversation replies carry the strategy + playbook version that shaped this
    // message, so message-level attribution is complete.
    recipe: buildSendRecipe({
      brain: "conversation_reply",
      strategy: bundle.attribution.strategy,
      playbookVersion: bundle.attribution.playbookVersion,
      // WS-3.4: the EXACT registry hash/model id that drafted this reply, threaded from the
      // brain's own prompt handle — never re-registered, so the hash can never drift.
      promptHash: RESPOND_SYSTEM.hash,
      modelId: getModelId(),
      // Phase 2C fast-follow: only stamped when best-of-N actually ran (n>1) — n<=1 keeps the
      // exact pre-existing recipe shape, so every existing recipe-equality test and every
      // off-by-default run stays byte-identical.
      ...(n > 1 ? { bestOfN: n } : {}),
    }),
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
  const event = deps.linkedinInfra.parseEventWebhook(payload.payload);
  if (!event) return { handled: false, action: "unparseable" };
  return handleLinkedInEvent(event, deps);
}

/**
 * The event-level core of runInbound — also the entry point for the thread sync, which reads
 * messages straight from the provider (no webhook payload) and must route them through exactly
 * the same matching, idempotency and side effects as a webhook delivery.
 */
export async function handleLinkedInEvent(event: LinkedInEvent, deps: InboundDeps): Promise<InboundSummary> {
  const now = deps.now?.() ?? new Date();

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

  // Lifecycle sender (0045): events on the founder identity are operator traffic, not
  // tenant outreach. A reply stops that user's lifecycle sequence forever and hands the
  // thread to the founder's real inbox; an acceptance opens the DM gate for a parked
  // invite. account_status events fall through above — the sender identity rides the
  // normal connection-health machinery. An unmatched event falls through to the tenant
  // path (the ops workspace may legitimately hold other traffic).
  if (deps.lifecycle && event.connectedAccountRef === deps.lifecycle.senderRef) {
    if (event.type === "relationship_accepted") {
      const matched = await deps.lifecycle.recordAcceptance(
        { providerRef: event.fromProviderRef, profileUrl: event.profileUrl },
        now
      );
      if (matched) return { handled: true, action: "lifecycle:accepted" };
    } else if (event.type === "reply") {
      const who = await deps.lifecycle.recordReply(
        { providerRef: event.fromProviderRef, profileUrl: event.fromProfileUrl },
        now
      );
      if (who) {
        try {
          await deps.lifecycle.notifyReply(who.displayName, event.body);
        } catch {
          // notification is best-effort; the stop-on-reply write already happened
        }
        return { handled: true, action: "lifecycle:reply" };
      }
    }
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

  if (event.type === "outbound_echo") {
    // A message the connected account itself sent. Ours (a dispatched send, incl. in-app manual
    // replies) is ignored; one typed natively in LinkedIn means a human took the thread over —
    // the agent stands down exactly as it does for an in-app manual reply.
    const lead = await matchLead(deps.store, accountId, {
      profileUrl: event.toProfileUrl,
      providerRef: event.fromProviderRef,
      publicIdentifier: event.fromPublicIdentifier,
      name: event.fromName,
    });
    if (!lead) return { handled: false, action: "no matching lead" };
    if (await deps.store.isOwnOutboundMessage(accountId, lead.id, event.providerEventId, event.body)) {
      return { handled: true, action: "echo:own" };
    }
    // Mirror the human's message into the thread — the inbox stitches threads from stored rows,
    // and this one existed nowhere else. Idempotent on the provider message id (0073).
    const sentAt = new Date(event.sentAt);
    const { created } = await deps.store.insertNativeMessage({
      accountId,
      leadId: lead.id,
      providerMessageRef: event.providerEventId,
      body: event.body,
      sentAt,
    });
    // Takeover is a reaction to a FRESH message, once. A replayed echo, or a days-old one found by
    // the thread sync, must not re-pause a thread the user has since handed back to the agent.
    if (!created) return { handled: true, action: "echo:duplicate" };
    if (now.getTime() - sentAt.getTime() > RESPOND_MAX_REPLY_AGE_MS) {
      return { handled: true, action: "echo:mirrored" };
    }
    await deps.store.pauseForHumanTakeover(accountId, lead.id, lead.campaignId);
    return { handled: true, action: "echo:human_takeover" };
  }

  // LinkedIn reply — explicit narrow so a future event variant can't fall into the reply path
  if (event.type !== "reply") return { handled: false, action: "unhandled event type" };
  const lead = await matchLead(deps.store, accountId, {
    profileUrl: event.fromProfileUrl,
    providerRef: event.fromProviderRef,
    publicIdentifier: event.fromPublicIdentifier,
    name: event.fromName,
  });
  if (!lead) return { handled: false, action: "no matching lead" };
  // provider_message_ref makes the insert idempotent (0043 partial unique index) — provider
  // retries and the stored-event replay can never double-count a reply.
  const receivedAt = new Date(event.receivedAt);
  const inserted = await deps.store.insertReply({
    accountId,
    leadId: lead.id,
    campaignId: lead.campaignId,
    channel: "linkedin",
    providerMessageRef: event.providerEventId,
    body: event.body,
    receivedAt,
  });
  if (inserted.created) {
    await deps.store.setReplyOutreachSend(
      inserted.id,
      await deps.store.lastDeliveredSendId(accountId, lead.id, receivedAt)
    );
  }
  // The classification is the processed marker, written LAST. An existing row WITHOUT one is a
  // run that crashed mid-way (its Trigger retry lands here) — finish it rather than drop the
  // reply unclassified, unsuppressed and un-notified. Every effect below is idempotent or
  // self-guarding on a retry (suppression upserts; a draft queued by the crashed run is newer
  // than the reply row, so the responder treats it as the answer).
  if (!inserted.created && inserted.classified) return { handled: true, action: "reply:duplicate" };
  const replyId = inserted.id;
  const verdict = await deps.classifyFn(event.body);

  // Rule 11: suppress the value every send-path check compares against — the lead's STORED url
  // (vanity / ACwAA form) — plus the payload's provider-id url as a second entry. Suppressing only
  // the payload url left opted-out leads contactable. Written first: the legal effect never waits
  // on (or is lost to) a later failure.
  const storedUrl = await deps.store.getLeadLinkedInUrl(accountId, lead.id);
  const suppressionValues = [
    ...new Set([storedUrl, event.fromProfileUrl].filter((u): u is string => Boolean(u)).map(normalizeLinkedInUrl)),
  ];
  // Conversation intelligence (spec §6.4): with the policy on, the reader's readout of this turn —
  // not the classifier — drives suppression, stop and the next move. No bundle (no live Outreach
  // agent / no insights) or an auto-responder ⇒ the classifier path below, unchanged.
  const conv = deps.conversation && deps.conversation.mode !== "off" ? deps.conversation : null;
  if (conv && verdict.classification !== "out_of_office") {
    const read = await readIncoming(conv, deps.store, accountId, lead, replyId, event.body, receivedAt);
    if (read) {
      return handleReadReply(deps, conv, {
        accountId,
        lead,
        reply: { id: replyId, body: event.body, receivedAt, ingestedAt: inserted.createdAt },
        verdict,
        suppressionValues,
        now,
        ...read,
      });
    }
  }

  if (verdict.classification === "not_interested" || verdict.classification === "unsubscribe") {
    for (const value of suppressionValues) {
      await deps.store.addSuppression(accountId, "linkedin", value, verdict.classification, lead.id);
    }
  }

  let responded = false;
  if (verdict.classification !== "out_of_office") {
    await applyGenuineReply(deps.store, accountId, lead, verdict, now);
    await notifyReplyEvent(deps, accountId, lead.id, verdict, event.body);
  }
  if (RESPONDABLE.has(verdict.classification) && !verdict.booked) {
    // Active responder: draft + queue the seller's next move, continuing the conversation toward close.
    responded = await maybeRespond(
      deps,
      accountId,
      lead,
      { id: replyId, body: event.body, receivedAt, ingestedAt: inserted.createdAt },
      verdict,
      suppressionValues,
      now
    );
    // Conversation cadence (0044): an engaged prospect's run switches to the conversation clock —
    // if they go quiet after this exchange, a thread-aware nudge follows in a couple of days
    // instead of the thread dying with the cold sequence. Booked = the win; no nudging needed.
    await deps.store.reviveSequenceRun(lead.id, new Date(now.getTime() + CONVERSATION_NUDGE_GAP_DAYS * DAY_MS));
  }
  await deps.store.setReplyClassification(replyId, verdict);
  return { handled: true, action: `reply:${verdict.classification}${responded ? "+responded" : ""}` };
}


/** Moment-of-value emails (L3): the two reply-driven events worth interrupting someone for.
 *  Best-effort — an email failure must never sink reply processing. */
async function notifyReplyEvent(
  deps: InboundDeps,
  accountId: string,
  leadId: string,
  verdict: ReplyVerdict,
  snippet: string
): Promise<void> {
  if (!deps.notifyLeadEvent) return;
  try {
    if (verdict.booked) {
      await deps.notifyLeadEvent({ kind: "meeting_booked", accountId, leadId, snippet });
    } else if (verdict.classification === "interested") {
      await deps.notifyLeadEvent({ kind: "interested_reply", accountId, leadId, snippet });
    }
  } catch {
    // swallowed by design
  }
}

type Conversation = NonNullable<InboundDeps["conversation"]>;

/** Shown when a reply reads negative but not confidently a decline: stop, and let a person confirm. */
export const SOFT_NO_NOTE = "This looked like a no — confirm before Vera continues.";

/**
 * Read the incoming reply against the lead's state as it stood BEFORE it (the reply row is already
 * in the thread, so the fold stops just short of it), apply the deterministic opt-out floor, and
 * persist the readout on the reply row. Null when there is no bundle to ground the read.
 */
async function readIncoming(
  conv: Conversation,
  store: InboundStore,
  accountId: string,
  lead: { id: string; campaignId: string | null },
  replyId: string,
  body: string,
  receivedAt: Date
): Promise<{ bundle: ResponderBundle; readout: Readout } | null> {
  // the incoming reply is excluded from the bundle's thread — the composer gets it as `incoming`
  const bundle = await store.getResponderBundle(accountId, lead.id, lead.campaignId, { excludeReplyId: replyId });
  if (!bundle) return null;
  const grounding = leadBlock({ lead: bundle.lead, insights: bundle.insights, context: bundle.context });
  const before = await syncState(accountId, lead.id, bundle.lead, bundle.insights, grounding, conv.deps, undefined, {
    stopBeforeRef: replyId,
  });
  let readout = await conv.deps.readFn(before, { ref: replyId, role: "lead", text: body, at: receivedAt.toISOString() }, grounding);
  // Rule 11 floor: an explicit removal request is an opt-out whatever the model read (readTurn
  // folds this in too; re-applied here so no injected reader can drop it).
  if (!readout.explicitOptOut && preClassify(body)?.classification === "unsubscribe") {
    readout = { ...readout, explicitOptOut: true, stance: "opt_out", intent: "opts_out" };
  }
  await store.setReplyReadout(replyId, readout);
  return { bundle, readout };
}

/**
 * The readout-driven twin of the classifier path (spec §6.4). The classifier's verdict still drives
 * the inbox chip and the reply notifications; it never suppresses or stops the run on its own here.
 *
 *   explicitOptOut, or negative ∧ confidence ≥ DECLINE_CONFIDENCE ∧ declines → suppress + stop
 *   any other negative                                                      → stop + needs_human, NO suppression
 *   ooo                                                                     → no action
 *   booked (classifier)                                                     → unchanged: stamp + stand down
 *
 * Routing: shadow ⇒ the core logs what it would do and the legacy responder still writes; live_replies
 * / live ⇒ the core replaces the legacy responder.
 */
async function handleReadReply(
  deps: InboundDeps,
  conv: Conversation,
  r: {
    accountId: string;
    lead: { id: string; campaignId: string | null };
    reply: { id: string; body: string; receivedAt: Date; ingestedAt: Date };
    verdict: ReplyVerdict;
    suppressionValues: string[];
    now: Date;
    bundle: ResponderBundle;
    readout: Readout;
  }
): Promise<InboundSummary> {
  const { accountId, lead, reply, verdict, readout, bundle, now } = r;
  const { store } = deps;
  const declines =
    readout.stance === "negative" && readout.confidence >= DECLINE_CONFIDENCE && readout.intent === "declines";
  const suppress = readout.explicitOptOut || declines;
  const ooo = readout.intent === "ooo";
  const softNo = !suppress && !ooo && readout.stance === "negative";

  // Rule 11 first: the legal effect never waits on (or is lost to) a later failure.
  if (suppress) {
    const source = readout.explicitOptOut ? "unsubscribe" : "not_interested";
    for (const value of r.suppressionValues) {
      await store.addSuppression(accountId, "linkedin", value, source, lead.id);
    }
  }

  let responded = false;
  if (!ooo || suppress) {
    await applyGenuineReply(store, accountId, lead, verdict, now, suppress || softNo);
    await notifyReplyEvent(deps, accountId, lead.id, verdict, reply.body);
    if (softNo) {
      await store.insertLeadNotification({ accountId, leadId: lead.id, kind: "needs_human", body: SOFT_NO_NOTE });
      try {
        await deps.notifyLeadEvent?.({ kind: "needs_human", accountId, leadId: lead.id, snippet: reply.body });
      } catch {
        // best-effort by design
      }
    }
  }

  if (!ooo && !suppress && !softNo && !verdict.booked) {
    let outcome: DecideOutcome | null = null;
    // the same stand-down guards as the legacy responder: a human driving, a stale replay, or a
    // queued message newer than this reply (it already is the answer) — no policy turn
    const fresh = now.getTime() - reply.receivedAt.getTime() <= RESPOND_MAX_REPLY_AGE_MS;
    const answered =
      bundle.newestUnsentMessageCreatedAt !== null && bundle.newestUnsentMessageCreatedAt > reply.ingestedAt;
    const decide = (mode: Exclude<typeof conv.mode, "off">) =>
      runConversationDecide(
        {
          accountId,
          leadId: lead.id,
          campaignId: bundle.campaignId,
          trigger: { kind: "reply", replyId: reply.id, incoming: reply.body, receivedAt: reply.receivedAt, readout },
          mode,
          bundle,
          sellerName: conv.sellerName !== undefined ? conv.sellerName : (bundle.context.accountName ?? null),
        },
        conv.deps
      );
    const canDecide = fresh && !answered && !bundle.humanHandled;
    if (conv.mode === "shadow") {
      if (canDecide) {
        try {
          await decide("shadow");
        } catch {
          // shadow is log-only: a policy failure must never sink reply processing
        }
      }
      responded = await maybeRespond(deps, accountId, lead, reply, verdict, r.suppressionValues, now);
    } else if (canDecide && conv.mode !== "off") {
      outcome = await decide(conv.mode);
      responded = outcome.action === "drafted" || outcome.action === "exit";
    }
    // a graceful exit or a hand-off stopped the run — never re-arm it
    if (outcome?.action !== "exit" && outcome?.action !== "hand_to_human") {
      await store.reviveSequenceRun(lead.id, new Date(now.getTime() + CONVERSATION_NUDGE_GAP_DAYS * DAY_MS));
    }
  }
  await store.setReplyClassification(reply.id, verdict);
  return { handled: true, action: `reply:${verdict.classification}${responded ? "+responded" : ""}` };
}
