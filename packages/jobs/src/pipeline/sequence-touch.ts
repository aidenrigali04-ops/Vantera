import { describeViolations } from "@vantera/agent-brains";
import type { DraftInput, Violation } from "@vantera/agent-brains";
import { normalizeLinkedInUrl } from "./copy-draft";
import { needsRefresh, FRESHNESS_WINDOW_DAYS } from "./freshness";
import type {
  NewScheduledSend,
  SequenceTouchDeps,
  SequenceTouchDispatch,
  SequenceTouchOutcome,
} from "./types";

/** Describe unresolved humanizer violations for the review queue (tolerant of an empty list). */
function flagsFor(violations: Violation[] | undefined): string | null {
  return violations && violations.length > 0 ? describeViolations(violations) : null;
}

/**
 * Draft and insert ONE LinkedIn follow-up touch for the orchestrator. The suppression re-check at
 * this boundary is the rule-11 send-path gate: it runs BEFORE any draft or insert, so a suppressed
 * lead is never drafted. Aged leads are re-ranked first; one that drops below min_score exits the
 * sequence (NOT suppression).
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

  const cta = await deps.store.getCampaignCta(d.campaignId);
  const input: DraftInput = {
    lead: {
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
      companyName: lead.companyName,
      industry: lead.industry,
    },
    insights: lead.aiInsights as DraftInput["insights"],
    context: { cta },
  };

  const draft = await deps.draftLinkedInFn(input);
  const styleFlags = flagsFor(draft.violations);

  const send: NewScheduledSend = {
    accountId: d.accountId,
    campaignId: d.campaignId,
    leadId: d.leadId,
    channel: "linkedin",
    subject: null,
    body: draft.connectionNote,
    status: styleFlags ? "pending_review" : "approved",
    linkedinStage: "message",
    styleFlags,
  };
  await deps.store.insertScheduledSend(send);
  return "drafted";
}
