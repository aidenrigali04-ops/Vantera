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
