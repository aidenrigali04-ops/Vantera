import { WORLD_RANGES, type WorldRanges } from "../hive/sim/world";
import { MIN_STAGE_SAMPLE } from "../optimize/funnel";

/**
 * Fit the simulator's base-rate bands to a real lead cohort, then check that prediction on a
 * later cohort the fit never saw.
 *
 * Counts are cohort totals, split by when the lead was created. Stage numerators are the
 * events that followed (invite, accept, interested reply, negative reply, meeting, close).
 * Lead attributes are not read: a current title or score is not treated as what was known
 * when the lead was sourced. Gene effects are not fit. History does not record which genome
 * produced each lead, so a hive champion cannot be replayed as a causal effect. The check
 * is whether the training window's base world predicts the holdout's meetings per 100 sourced.
 *
 * A stage is usable only when its denominator clears MIN_STAGE_SAMPLE. Below that the assumed
 * WORLD_RANGES stay in place.
 */

export type FunnelCohort = {
  sourced: number;
  qualified: number;
  invited: number;
  accepted: number;
  interested: number;
  /** Distinct leads with a not-interested or unsubscribe reply. */
  negative: number;
  booked: number;
  closed: number;
};

export type StageFit = { p: number; low: number; high: number; numerator: number; denominator: number };

const STAGES = [
  { key: "qual", num: "qualified", den: "sourced" },
  { key: "acc", num: "accepted", den: "invited" },
  { key: "rep", num: "interested", den: "accepted" },
  { key: "neg", num: "negative", den: "accepted" },
  { key: "book", num: "booked", den: "interested" },
  { key: "close", num: "closed", den: "booked" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

/** Wilson interval for a binomial proportion. `low`/`high` are on 0–1. */
export function wilson(successes: number, n: number, z = 1.96): { p: number; low: number; high: number } {
  if (n <= 0) return { p: 0, low: 0, high: 0 };
  const ph = clamp01(successes / n);
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (ph + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((ph * (1 - ph)) / n + z2 / (4 * n * n));
  return { p: ph, low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** A logit-safe band around the Wilson interval. A very tight interval is opened to ±1 point so accounts are not identical. */
function band(point: number, low: number, high: number): readonly [number, number] {
  let lo = Math.max(0.01, low);
  let hi = Math.min(0.99, high);
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi - lo < 0.02) {
    const mid = Math.min(0.98, Math.max(0.02, point));
    lo = Math.max(0.01, mid - 0.01);
    hi = Math.min(0.99, mid + 0.01);
  }
  return [lo, hi];
}

export function stageFits(cohort: FunnelCohort): Record<StageKey, StageFit> {
  const out = {} as Record<StageKey, StageFit>;
  for (const s of STAGES) {
    const numerator = cohort[s.num];
    const denominator = cohort[s.den];
    const w = wilson(numerator, denominator);
    out[s.key] = { p: w.p, low: w.low, high: w.high, numerator, denominator };
  }
  return out;
}

export type FitResult = {
  fitted: boolean;
  /** Assumed ranges when the cohort is too thin; Wilson bands when it is not. */
  ranges: WorldRanges;
  rates: Record<StageKey, StageFit>;
  /** Stages whose denominator is below the sample gate. */
  short: { stage: StageKey; n: number; need: number }[];
  reason: string;
};

/**
 * Replace the six stage bands when every stage clears the sample gate.
 * Daily volume and intent share are copied from WORLD_RANGES: a cohort does not measure them.
 */
export function fitRanges(train: FunnelCohort): FitResult {
  const rates = stageFits(train);
  const short = STAGES.filter((s) => rates[s.key].denominator < MIN_STAGE_SAMPLE).map((s) => ({
    stage: s.key,
    n: rates[s.key].denominator,
    need: MIN_STAGE_SAMPLE,
  }));
  if (short.length) {
    return {
      fitted: false,
      ranges: WORLD_RANGES,
      rates,
      short,
      reason: `Training cohort is too thin to replace the assumed ranges (${short.map((s) => `${s.stage} ${s.n}/${s.need}`).join(", ")}).`,
    };
  }
  const ranges: WorldRanges = {
    ...WORLD_RANGES,
    qual: band(rates.qual.p, rates.qual.low, rates.qual.high),
    acc: band(rates.acc.p, rates.acc.low, rates.acc.high),
    rep: band(rates.rep.p, rates.rep.low, rates.rep.high),
    neg: band(rates.neg.p, rates.neg.low, rates.neg.high),
    book: band(rates.book.p, rates.book.low, rates.book.high),
    close: band(rates.close.p, rates.close.low, rates.close.high),
  };
  return {
    fitted: true,
    ranges,
    rates,
    short: [],
    reason: "Stage bands are the training cohort's Wilson intervals. Gene effects are still the simulator's, not measured.",
  };
}

/** Meetings per 100 sourced implied by multiplying the fitted stage rates. This is what a default genome scores before gene effects. */
export function simulatorMeetingsPer100(rates: Record<StageKey, StageFit>): number {
  return 100 * rates.qual.p * rates.acc.p * rates.rep.p * rates.book.p;
}

/** Observed meetings per 100 sourced: booked leads over sourced leads, with a Wilson interval. */
export function observedMeetings(cohort: FunnelCohort): { per100: number; low: number; high: number; n: number } {
  const w = wilson(cohort.booked, cohort.sourced);
  return { per100: 100 * w.p, low: 100 * w.low, high: 100 * w.high, n: cohort.sourced };
}

export type HoldoutStatus = "inside" | "outside" | "inconclusive";

export type HoldoutReport = {
  status: HoldoutStatus;
  reason: string;
  fitted: boolean;
  /** Default-genome prediction from the training window, meetings per 100 sourced. */
  predicted: number | null;
  /** Holdout booked / sourced, meetings per 100. */
  actual: number | null;
  actualLow: number | null;
  actualHigh: number | null;
};

/**
 * Predict from the training window and ask whether that prediction lands in the holdout's
 * Wilson interval for meetings per 100 sourced. The holdout cohort must itself clear the
 * sample gate. This does not score a hive champion: the champion's genes were not the
 * treatment these leads received.
 */
export function checkHoldout(train: FunnelCohort, holdout: FunnelCohort): HoldoutReport {
  const fit = fitRanges(train);
  if (!fit.fitted) {
    return { status: "inconclusive", reason: fit.reason, fitted: false, predicted: null, actual: null, actualLow: null, actualHigh: null };
  }
  const actual = observedMeetings(holdout);
  if (holdout.sourced < MIN_STAGE_SAMPLE) {
    return {
      status: "inconclusive",
      reason: `Holdout has ${holdout.sourced} sourced leads; ${MIN_STAGE_SAMPLE} are required before the prediction can be checked.`,
      fitted: true,
      predicted: simulatorMeetingsPer100(fit.rates),
      actual: actual.per100,
      actualLow: actual.low,
      actualHigh: actual.high,
    };
  }
  const predicted = simulatorMeetingsPer100(fit.rates);
  const inside = predicted >= actual.low && predicted <= actual.high;
  return {
    status: inside ? "inside" : "outside",
    fitted: true,
    predicted,
    actual: actual.per100,
    actualLow: actual.low,
    actualHigh: actual.high,
    reason: inside
      ? `Training prediction ${predicted.toFixed(2)} sits inside the holdout interval ${actual.low.toFixed(2)}–${actual.high.toFixed(2)} meetings per 100 sourced.`
      : `Training prediction ${predicted.toFixed(2)} is outside the holdout interval ${actual.low.toFixed(2)}–${actual.high.toFixed(2)} (actual ${actual.per100.toFixed(2)}).`,
  };
}
