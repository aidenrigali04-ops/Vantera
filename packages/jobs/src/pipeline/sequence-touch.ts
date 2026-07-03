import { describeViolations } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import { needsRefresh, FRESHNESS_WINDOW_DAYS } from "./freshness";
import type {
  NewScheduledSend,
  SequenceTouchDeps,
  SequenceTouchDispatch,
  SequenceTouchOutcome,
} from "./types";

/**
 * Draft and insert ONE LinkedIn follow-up touch for the orchestrator. The suppression re-check at
 * this boundary is the rule-11 send-path gate: it runs BEFORE any draft or insert, so a suppressed
 * lead is never drafted. Aged leads are re-ranked first; one that drops below min_score exits the
 * sequence (NOT suppression).
 *
 * The follow-up is drafted by the CONVERSATION brain (same one the reply responder uses), grounded
 * in the running thread — so touch N builds on what was already said instead of re-sending a cold
 * first message. (Previously this re-used the connection-note copy, which made every follow-up read
 * like an intro — fixed 2026-06-29.)
 */
export async function runSequenceTouch(
  d: SequenceTouchDispatch,
  deps: SequenceTouchDeps
): Promise<SequenceTouchOutcome> {
  const lead = await deps.store.getDraftableLead(d.accountId, d.leadId);
  if (!lead) return "skipped";

  const value = lead.linkedinUrl;
  if (!value) return "skipped";

  const normalized = normalizeLinkedInUrl(value);
  if (await deps.store.isSuppressed(d.accountId, "linkedin", normalized)) {
    return "suppressed";
  }

  if (needsRefresh(lead.scoredAt, deps.now(), FRESHNESS_WINDOW_DAYS)) {
    const refresh = await deps.refreshLead(d.accountId, d.leadId);
    if (refresh === "dropped") {
      await deps.store.stopSequenceRun(d.runId); // lead exits the sequence — no further touches
      return "dropped";
    }
  }

  // Grounding + running thread (same source the reply responder uses). null ⇒ no live Outreach
  // agent or no insights to ground a message → skip rather than send something cold/generic.
  const bundle = await deps.store.getResponderBundle(d.accountId, d.leadId, d.campaignId);
  if (!bundle) return "skipped";

  // Proactive follow-up: no incoming reply → the brain writes a fresh nudge that builds on the thread.
  const followupInput = {
    lead: bundle.lead,
    insights: bundle.insights,
    context: bundle.context,
    thread: bundle.thread,
  };
  let draft = await deps.draftFollowupFn(followupInput);
  // Automatic senders get ONE targeted fix of a flagged follow-up before it may auto-send; the fix
  // is re-linted with the same bar, so a still-flagged result falls through to review below.
  if (bundle.sendMode === "automatic" && draft.violations.length > 0 && deps.fixFollowupFn) {
    draft = await deps.fixFollowupFn(draft, followupInput);
  }
  const styleFlags = draft.violations.length > 0 ? describeViolations(draft.violations) : null;
  // Respect the agent's send mode (like copy-draft / the responder): automatic auto-approves a clean
  // follow-up; review mode — or any style-flagged draft — waits in the review queue.
  const status: NewScheduledSend["status"] =
    bundle.sendMode === "automatic" && styleFlags === null ? "approved" : "pending_review";

  const send: NewScheduledSend = {
    accountId: d.accountId,
    campaignId: d.campaignId,
    leadId: d.leadId,
    channel: "linkedin",
    subject: null,
    body: draft.message,
    status,
    linkedinStage: "message",
    styleFlags,
  };
  await deps.store.insertScheduledSend(send);
  return "drafted";
}
