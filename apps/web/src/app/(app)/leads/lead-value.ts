/**
 * Pure helpers for the lead-profile drawer's value/dopamine layer (retention:
 * goal-gradient). Kept framework-free so the scoring/revenue logic is unit-tested
 * without rendering. Projected revenue uses the account's real avg deal value —
 * the same number that powers the dashboard pipeline math — never a guess.
 */

export type ScoreTier = "hot" | "strong" | "look" | "unscored";

export interface ScoreVerdict {
  tier: ScoreTier;
  label: string;
}

/**
 * Turn the 0–100 AI fit score into a verdict the user *feels*. Thresholds align
 * with the qualification gate (default min_score 70): ≥85 is a standout, 70–84
 * clears the bar, below that is a maybe.
 */
export function scoreVerdict(score: number | null): ScoreVerdict {
  if (score == null) return { tier: "unscored", label: "Not scored yet" };
  if (score >= 85) return { tier: "hot", label: "Hot lead" };
  if (score >= 70) return { tier: "strong", label: "Strong fit" };
  return { tier: "look", label: "Worth a look" };
}

export interface ProjectedRevenue {
  /** full deal value in cents — what closing this prospect is worth */
  valueCents: number;
  /** how many deals of this size reach the MRR goal, or null if no goal set */
  dealsToGoal: number | null;
}

/**
 * "Worth ≈ $X to your goal." Full deal value (the honest, hardest-hitting number),
 * with a deals-to-goal count for the goal-gradient line. Null when the account has
 * no deal value set — the pill is hidden rather than showing $0.
 */
export function projectedRevenue(
  avgDealValueCents: number | null,
  goalCents: number | null
): ProjectedRevenue | null {
  if (!avgDealValueCents || avgDealValueCents <= 0) return null;
  const dealsToGoal =
    goalCents && goalCents > 0 ? Math.max(1, Math.ceil(goalCents / avgDealValueCents)) : null;
  return { valueCents: avgDealValueCents, dealsToGoal };
}

const EMAIL_STATUS: Record<string, string> = {
  unverified: "Unverified",
  valid: "Verified",
  invalid: "Invalid",
  risky: "Risky",
};

const PHONE_STATUS: Record<string, string> = {
  unvalidated: "Unvalidated",
  valid: "Verified",
  invalid: "Invalid",
};

export function humanizeEmailStatus(status: string): string {
  return EMAIL_STATUS[status] ?? status;
}

export function humanizePhoneStatus(status: string): string {
  return PHONE_STATUS[status] ?? status;
}

/** Only a confirmed-good contact reads as verified (drives the check + ring). */
export function isVerified(status: string): boolean {
  return status === "valid";
}
