import type { FunnelStageKey } from "./funnel";
import type { VariantOutcome } from "./decide";

/**
 * Aggregate an experiment arm's per-lead outcome flags into the stage's VariantOutcome (Phase 3).
 * Pure — the DB layer fetches the flags; this decides what counts as the denominator, a success, and
 * a harm signal for the experiment's target stage. Negatives are counted only among leads that
 * reached the stage's input population, so the harm rate is apples-to-apples with the win rate.
 */

/** Per-lead outcome flags for one arm, derived from the lead row + its replies. */
export type LeadOutcomeFlags = {
  invited: boolean; // linkedin_invited_at present
  accepted: boolean; // linkedin_connected_at present
  interested: boolean; // has an interested reply
  negative: boolean; // has a not_interested or unsubscribe reply
  booked: boolean; // meeting_booked_at present
  converted: boolean; // status = 'converted'
};

function inDenominator(stageKey: FunnelStageKey, f: LeadOutcomeFlags): boolean {
  switch (stageKey) {
    case "acceptance":
      return f.invited;
    case "reply":
      return f.accepted;
    case "booking":
      return f.interested;
    case "close":
      return f.booked;
  }
}

function isSuccess(stageKey: FunnelStageKey, f: LeadOutcomeFlags): boolean {
  switch (stageKey) {
    case "acceptance":
      return f.accepted;
    case "reply":
      return f.interested;
    case "booking":
      return f.booked;
    case "close":
      return f.converted;
  }
}

export function aggregateArm(stageKey: FunnelStageKey, flags: LeadOutcomeFlags[]): VariantOutcome {
  let denominator = 0;
  let successes = 0;
  let negatives = 0;
  for (const f of flags) {
    if (!inDenominator(stageKey, f)) continue;
    denominator++;
    if (isSuccess(stageKey, f)) successes++;
    if (f.negative) negatives++;
  }
  return { denominator, successes, negatives };
}
