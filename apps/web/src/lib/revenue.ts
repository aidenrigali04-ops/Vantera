// Dashboard revenue snapshot math. Leads carry no dollar value, so revenue is
// derived from real lead counts × the account's avg value per client (Settings).
// Closed = converted clients; expected = pipeline leads weighted by how close
// each stage is to closing. Pure + deterministic so it's unit-tested and the
// dashboard stays a thin caller.

export type PipelineStageCounts = {
  /** qualified + enriched — passed the gate, not yet in outreach */
  qualified: number;
  /** in_campaign — actively being messaged */
  inOutreach: number;
  /** replied (warm), excluding converted */
  replied: number;
};

/**
 * Probability a lead at each stage becomes a closed client. Conservative and
 * monotonic by stage so the "expected" figure reads as a credible projection,
 * never a fantasy. Tune here only.
 */
export const STAGE_WEIGHTS: Readonly<Record<keyof PipelineStageCounts, number>> = {
  qualified: 0.1,
  inOutreach: 0.25,
  replied: 0.5,
};

export type RevenueSnapshot = {
  /** avg value per client is set (> 0) — gate dollar figures behind this */
  hasValue: boolean;
  /** converted clients × value */
  closedCents: number;
  /** stage-weighted pipeline × value, rounded */
  expectedCents: number;
  goalCents: number | null;
  /** closed as % of goal, 0–100 (capped); null when no goal */
  closedPctOfGoal: number | null;
  /** (closed + expected) as % of goal, 0–100 (capped); null when no goal */
  projectedPctOfGoal: number | null;
};

export type RevenuePoint = {
  /** UTC day, yyyy-mm-dd — the x-axis tick */
  date: string;
  /** cumulative closed MRR (cents) through this day */
  closedCents: number;
  /** closed + current expected pipeline (cents) — the projected ceiling */
  projectedCents: number;
};

/**
 * Daily time series for the revenue chart over the last `days`. `closed` is real:
 * cumulative converted clients (by conversion date) × value per client — and it
 * counts conversions from before the window so the line starts at the right
 * baseline. `projected` overlays the current stage-weighted pipeline as the
 * ceiling "if your warm pipeline closes". Empty when no value per client is set.
 */
export function buildRevenueSeries(input: {
  conversionDates: string[];
  avgDealValueCents: number | null;
  expectedPipelineCents: number;
  days?: number;
  now?: Date;
}): RevenuePoint[] {
  const {
    conversionDates,
    avgDealValueCents,
    expectedPipelineCents,
    days = 30,
    now = new Date(),
  } = input;
  if (!avgDealValueCents || avgDealValueCents <= 0) return [];

  const convMs = conversionDates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const dayMs = 86_400_000;
  const startOfTodayUtc = Math.floor(now.getTime() / dayMs) * dayMs;
  const points: RevenuePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = startOfTodayUtc - i * dayMs;
    const dayEnd = dayStart + dayMs - 1;
    const convertedByDay = convMs.filter((t) => t <= dayEnd).length;
    const closedCents = convertedByDay * avgDealValueCents;
    points.push({
      date: new Date(dayStart).toISOString().slice(0, 10),
      closedCents,
      projectedCents: closedCents + expectedPipelineCents,
    });
  }
  return points;
}

/**
 * Forward goal pace, from the cumulative-closed-MRR model. `reached` once closed
 * MRR is at/over goal; otherwise `etaDays` projects when closed MRR reaches the
 * goal at the trailing-30-day conversion rate. Null when there's no goal/value or
 * no run-rate yet (no conversions in the window) — callers fall back to the
 * existing % copy. Pure + deterministic (`now` injectable) so it's unit-tested.
 */
export function computeGoalPace(input: {
  conversionDates: string[];
  avgDealValueCents: number | null;
  goalCents: number | null;
  convertedClients: number;
  now?: Date;
}): { reached: boolean; etaDays: number | null } | null {
  const { conversionDates, avgDealValueCents, goalCents, convertedClients, now = new Date() } = input;
  if (!goalCents || goalCents <= 0 || !avgDealValueCents || avgDealValueCents <= 0) return null;

  const closedCents = convertedClients * avgDealValueCents;
  if (closedCents >= goalCents) return { reached: true, etaDays: null };

  const dayMs = 86_400_000;
  const windowStart = now.getTime() - 30 * dayMs;
  const recent = conversionDates.filter((d) => {
    const t = new Date(d).getTime();
    return Number.isFinite(t) && t >= windowStart;
  }).length;
  if (recent === 0) return null; // no run-rate to project from yet

  const cents30 = recent * avgDealValueCents;
  const etaDays = Math.ceil(((goalCents - closedCents) / cents30) * 30);
  return { reached: false, etaDays };
}

export function computeRevenueSnapshot(input: {
  convertedClients: number;
  pipeline: PipelineStageCounts;
  avgDealValueCents: number | null;
  goalCents: number | null;
}): RevenueSnapshot {
  const { convertedClients, pipeline, avgDealValueCents, goalCents } = input;
  const hasValue = avgDealValueCents != null && avgDealValueCents > 0;
  const value = hasValue ? avgDealValueCents! : 0;

  const closedCents = convertedClients * value;
  const weightedLeads =
    pipeline.qualified * STAGE_WEIGHTS.qualified +
    pipeline.inOutreach * STAGE_WEIGHTS.inOutreach +
    pipeline.replied * STAGE_WEIGHTS.replied;
  const expectedCents = Math.round(weightedLeads * value);

  const pct = (cents: number): number | null =>
    goalCents && goalCents > 0 ? Math.min(100, Math.round((cents / goalCents) * 100)) : null;

  return {
    hasValue,
    closedCents,
    expectedCents,
    goalCents,
    closedPctOfGoal: pct(closedCents),
    projectedPctOfGoal: pct(closedCents + expectedCents),
  };
}

// ── Funnel & ROI (WS-A) ──────────────────────────────────────────────────────
// The category's #1 churn driver is a CFO killing the budget when attributable
// pipeline comes in under ~2× spend. These pure functions turn lead-lifecycle
// counts + the account's plan price into the funnel and the spend ratio a CFO
// would ask for. Spend is the plan price (what the customer pays Vantera), passed
// in by the caller — never COGS.

/** Lead-lifecycle counts that form the revenue funnel, in stage order. */
export type FunnelCounts = {
  /** passed the quality gate */
  qualified: number;
  /** entered outreach (in_campaign or beyond) */
  contacted: number;
  /** replied (replied or beyond) */
  replied: number;
  /** a meeting was booked (leads.meeting_booked_at) */
  meetings: number;
  /** closed-won (status='converted') */
  closed: number;
};

export type FunnelStage = {
  key: keyof FunnelCounts;
  label: string;
  count: number;
  /** % of the previous stage that reached this one; null for the first stage or an empty predecessor */
  conversionPct: number | null;
};

const FUNNEL_ORDER: readonly { key: keyof FunnelCounts; label: string }[] = [
  { key: "qualified", label: "Qualified" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "meetings", label: "Meetings" },
  { key: "closed", label: "Closed" },
];

/** Ordered funnel with stage-to-stage conversion. Pure; never divides by zero. */
export function computeFunnel(counts: FunnelCounts): FunnelStage[] {
  return FUNNEL_ORDER.map((stage, i) => {
    const count = counts[stage.key];
    const prev = i === 0 ? null : counts[FUNNEL_ORDER[i - 1]!.key];
    const conversionPct = prev && prev > 0 ? Math.round((count / prev) * 100) : null;
    return { key: stage.key, label: stage.label, count, conversionPct };
  });
}

export type RoiInput = {
  /** closed-won revenue (converted clients × value) */
  closedCents: number;
  /** stage-weighted expected pipeline (computeRevenueSnapshot.expectedCents) */
  pipelineCents: number;
  /** the account's plan price per month; null when not on a paid plan */
  planMonthlyCents: number | null;
  meetings: number;
  closes: number;
};

export type Roi = {
  hasSpend: boolean;
  monthlySpendCents: number;
  annualSpendCents: number;
  /** (closed + expected pipeline) ÷ annual spend, to 1 dp; null without spend */
  pipelineToSpend: number | null;
  /** the report's renewal bar: pipeline should clear 2× annual spend */
  meetsThreshold: boolean | null;
  /** monthly spend per booked meeting; null without spend or meetings */
  costPerMeetingCents: number | null;
  /** monthly spend per closed deal; null without spend or closes */
  costPerCloseCents: number | null;
};

/** The CFO view: annual pipeline-to-spend ratio (vs the 2× bar) and cost per meeting/close. */
export function computeRoi(input: RoiInput): Roi {
  const { closedCents, pipelineCents, planMonthlyCents, meetings, closes } = input;
  const hasSpend = planMonthlyCents != null && planMonthlyCents > 0;
  const monthlySpendCents = hasSpend ? planMonthlyCents! : 0;
  const annualSpendCents = monthlySpendCents * 12;

  const pipelineToSpend =
    annualSpendCents > 0
      ? Math.round(((closedCents + pipelineCents) / annualSpendCents) * 10) / 10
      : null;

  return {
    hasSpend,
    monthlySpendCents,
    annualSpendCents,
    pipelineToSpend,
    meetsThreshold: pipelineToSpend == null ? null : pipelineToSpend >= 2,
    costPerMeetingCents: hasSpend && meetings > 0 ? Math.round(monthlySpendCents / meetings) : null,
    costPerCloseCents: hasSpend && closes > 0 ? Math.round(monthlySpendCents / closes) : null,
  };
}
