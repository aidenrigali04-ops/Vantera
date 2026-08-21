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

/** A standout fit — the bar for the "Hot right now" spotlight and the "Hot lead" verdict. */
export const HOT_MIN_SCORE = 85;

/**
 * Turn the 0–100 AI fit score into a verdict the user *feels*. Thresholds align
 * with the qualification gate (default min_score 70): ≥85 is a standout, 70–84
 * clears the bar, below that is a maybe.
 */
export function scoreVerdict(score: number | null): ScoreVerdict {
  if (score == null) return { tier: "unscored", label: "Not scored yet" };
  if (score >= HOT_MIN_SCORE) return { tier: "hot", label: "Hot lead" };
  if (score >= QUALIFIED_MIN_SCORE) return { tier: "strong", label: "Strong fit" };
  return { tier: "look", label: "Worth a look" };
}

/** The qualification bar (rule 06 default min_score). Value is shown only at/above it. */
export const QUALIFIED_MIN_SCORE = 70;

export interface ProjectedRevenue {
  /** deal value in cents — what a client of this fit is worth to the goal */
  valueCents: number;
  /** how many deals of this size reach the MRR goal, or null if no goal set */
  dealsToGoal: number | null;
}

/**
 * "What a client like this is worth to your goal." Shown ONLY for a lead that has cleared the
 * qualification bar — never dangled on a weak or unscored lead (the SDR market report's #2
 * response-below-promise + #4 false-qualification traps: an inflated, identical dollar figure on
 * every lead reads as a false promise). Value is the account's real avg deal value; null when
 * there's no deal value set or the lead hasn't earned the framing.
 */
export function projectedRevenue(
  avgDealValueCents: number | null,
  goalCents: number | null,
  score: number | null
): ProjectedRevenue | null {
  if (!avgDealValueCents || avgDealValueCents <= 0) return null;
  if (score == null || score < QUALIFIED_MIN_SCORE) return null;
  const dealsToGoal =
    goalCents && goalCents > 0 ? Math.max(1, Math.ceil(goalCents / avgDealValueCents)) : null;
  return { valueCents: avgDealValueCents, dealsToGoal };
}

/** A lead whose research is older than this reads as aging — surfaced, not hidden (report #9). */
export const FRESHNESS_STALE_DAYS = 30;

export interface DataFreshness {
  /** human label of when the lead was last scored/enriched, e.g. "today", "3d ago", "6w ago" */
  label: string;
  /** older than the freshness window — its intel may be stale (the "2022 phonebook" risk) */
  stale: boolean;
}

/**
 * How fresh a lead's research is, from its last AI-score timestamp. Stale data is a top churn
 * driver in the report (#9) — outreach off a months-old signal or an unre-verified contact erodes
 * trust. Surfacing recency lets the user trust (or re-check) the intel. Null = never scored.
 */
export function dataFreshness(scoredAtIso: string | null, now: Date = new Date()): DataFreshness | null {
  if (!scoredAtIso) return null;
  const t = new Date(scoredAtIso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days < 0) return { label: "just now", stale: false };
  let label: string;
  if (days === 0) label = "today";
  else if (days < 14) label = `${days}d ago`;
  else if (days < 60) label = `${Math.round(days / 7)}w ago`;
  else label = `${Math.round(days / 30)}mo ago`;
  return { label, stale: days > FRESHNESS_STALE_DAYS };
}

/**
 * The single "why now" line from the lead's AI-derived insights — prefers a timing trigger (what
 * changed that makes now the moment), falling back to the top pain point. Returns null when there's
 * nothing to say — never a filler line.
 */
export function whyNowSignal(
  insights: { triggers?: string[]; pain_points?: string[] } | null | undefined
): string | null {
  if (!insights) return null;
  return insights.triggers?.[0] ?? insights.pain_points?.[0] ?? null;
}

/** A real captured buying signal (lead_signals, 0031) — events + intent from enrichment. */
export interface LeadSignalView {
  kind: string;
  label: string | null;
  detail?: string | null;
  observed_at?: string | null;
}

/** Freshest real signal first (by observed_at desc; undated sort last). Pure; safe on empty/null. */
export function topLeadSignal(signals: LeadSignalView[] | null | undefined): LeadSignalView | null {
  if (!signals || signals.length === 0) return null;
  const at = (s: LeadSignalView) => (s.observed_at ? new Date(s.observed_at).getTime() : -Infinity);
  return [...signals].sort((a, b) => at(b) - at(a))[0]!;
}

/**
 * The lead's "why now" line, REAL signal first. A captured event/intent signal (funding, exec hire,
 * intent, …) is insider intel and beats an AI-inferred trigger, so it wins; otherwise we fall back to
 * the AI insight (`whyNowSignal`). This is the anticipation hit (retention: variable reward).
 */
export function leadSignalLine(
  signals: LeadSignalView[] | null | undefined,
  insights: { triggers?: string[]; pain_points?: string[] } | null | undefined
): string | null {
  const top = topLeadSignal(signals);
  if (top) return top.label ?? top.detail ?? null;
  return whyNowSignal(insights);
}

/** A warm lead that's gone quiet this long reads as cooling — surfaced, not hidden (loss aversion). */
export const COOLING_DAYS = 3;

export interface CoolingState {
  /** days since the last reply landed */
  daysWaiting: number;
  /** loss-aversion label, e.g. "Reply waiting 4d" */
  label: string;
}

/**
 * Loss-aversion marker for a replied-but-unworked lead: a warm reply left sitting is the warm
 * pipeline going cold (the dashboard's cold-leads monitor, mirrored onto the row). Only fires for
 * `replied` status (a converted lead isn't cooling; an un-replied one has nothing waiting). Null
 * until the reply has waited COOLING_DAYS — so the marker means "act now", never decoration.
 */
export function coolingState(
  status: string,
  latestReplyIso: string | null | undefined,
  now: Date = new Date()
): CoolingState | null {
  if (status !== "replied" || !latestReplyIso) return null;
  const t = new Date(latestReplyIso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days < COOLING_DAYS) return null;
  return { daysWaiting: days, label: `Reply waiting ${days}d` };
}

/** Shared relative-day label: "today", "3d ago", "4w ago", "2mo ago". Null on a bad date. */
function relativeDays(iso: string, now: Date): string | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export interface LastActivity {
  kind: "reply" | "scored" | "sourced";
  /** e.g. "Replied 2d ago", "Researched today", "Sourced 4w ago" */
  label: string;
}

/**
 * The most recent thing that happened to a lead, for the table's Last-activity column — a reply
 * beats a research pass beats sourcing. Null when nothing is dated: an honest blank, never a
 * fabricated timestamp.
 */
export function lastActivity(
  latestReplyIso: string | null | undefined,
  scoredAtIso: string | null | undefined,
  createdAtIso: string | null | undefined,
  now: Date = new Date()
): LastActivity | null {
  if (latestReplyIso) {
    const rel = relativeDays(latestReplyIso, now);
    if (rel) return { kind: "reply", label: `Replied ${rel === "today" ? "today" : rel}` };
  }
  if (scoredAtIso) {
    const rel = relativeDays(scoredAtIso, now);
    if (rel) return { kind: "scored", label: `Researched ${rel}` };
  }
  if (createdAtIso) {
    const rel = relativeDays(createdAtIso, now);
    if (rel) return { kind: "sourced", label: `Sourced ${rel}` };
  }
  return null;
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
