import { checkCircuitBreaker, DECIDE_DEFAULTS, type ExperimentVerdict, type VariantOutcome } from "./decide";
import { eValueTwoProportions, posteriorSummary } from "./eprocess";

/**
 * The e-process decision gate (enterprise-grade-brain Phase 2A, WS-1.1). Supersedes the Wilson-
 * interval gate in decide.ts with an anytime-valid e-value threshold plus a Monte-Carlo posterior
 * read — decide.ts stays untouched and in production use until this is proven out (Task 6's sim
 * calibration is the gate to actually switching consumers over).
 *
 * Decision order is locked:
 *   1. Do-no-harm circuit breaker — FIRST, verbatim legacy semantics (shared with decideExperiment
 *      via checkCircuitBreaker in decide.ts — never re-implemented).
 *   2. e = eValueTwoProportions(champion, challenger); e < 1/alpha → keep_running. No minimum-n
 *      floor: a small n simply can't reach e >= 1/alpha, so the e-threshold IS the evidence gate.
 *   3. posteriorSummary(champion, challenger, rng): a confirmed AND practically meaningful win
 *      (medianLiftPp >= minEffectPp) that also clears the expected-loss ceiling
 *      (expectedAdoptionLossPp <= maxAdoptionLossPp) adopts; a confirmed loss discards; anything
 *      else (including a confirmed win blocked by the loss cap) keeps running.
 */

export type DecideV2Options = {
  /** alpha spent on this experiment (e-threshold = 1/alpha); hard bounds [0.002, 0.05] */
  alpha?: number;
  /** posterior median lift required to adopt (pp); hard bounds [1, 10] */
  minEffectPp?: number;
  /** expected-loss ceiling for adopting (pp); hard bounds [0.1, 2] */
  maxAdoptionLossPp?: number;
  /** breaker: unchanged semantics, reused from decide.ts */
  breakerMinSample?: number;
  harmMarginPp?: number;
  hardNegCeilingPct?: number;
  /** injectable RNG for the Monte-Carlo posterior read (default Math.random) */
  rng?: () => number;
};

export const DECIDE_V2_DEFAULTS: Required<Omit<DecideV2Options, "rng">> = {
  alpha: 0.05,
  minEffectPp: 3,
  maxAdoptionLossPp: 0.5,
  // Breaker constants carried over from the legacy gate (DECIDE_DEFAULTS) — unchanged semantics.
  breakerMinSample: DECIDE_DEFAULTS.breakerMinSample,
  harmMarginPp: DECIDE_DEFAULTS.harmMarginPp,
  hardNegCeilingPct: DECIDE_DEFAULTS.hardNegCeilingPct,
};

/** Clamp a number into [min, max]. NaN falls back to `fallback`; +/-Infinity clamp to the nearer bound. */
function clampNum(value: number | undefined, fallback: number, min: number, max?: number): number {
  const v = value ?? fallback;
  if (Number.isNaN(v)) return fallback;
  const withMin = Math.max(v, min);
  return max === undefined ? withMin : Math.min(withMin, max);
}

/**
 * Hard safety envelope for V2 config (WS-3.3): this config may come from a DB row later (a
 * stored experiment/recipe config, once Task 6+ wires that up) — clamping happens HERE, in code,
 * so a bad or stale stored value can never produce a reckless gate. Never throws.
 *
 * `decideExperimentV2` itself does NOT call this — it trusts its typed `options` directly, the
 * same posture `decideExperiment` already takes. Any call site that loads config from an
 * untrusted source (a DB row) must run it through `clampDecideV2Options` before constructing the
 * options object passed to `decideExperimentV2`.
 */
export function clampDecideV2Options(raw: Partial<DecideV2Options>): Required<Omit<DecideV2Options, "rng">> {
  return {
    alpha: clampNum(raw.alpha, DECIDE_V2_DEFAULTS.alpha, 0.002, 0.05),
    minEffectPp: clampNum(raw.minEffectPp, DECIDE_V2_DEFAULTS.minEffectPp, 1, 10),
    maxAdoptionLossPp: clampNum(raw.maxAdoptionLossPp, DECIDE_V2_DEFAULTS.maxAdoptionLossPp, 0.1, 2),
    breakerMinSample: clampNum(raw.breakerMinSample, DECIDE_V2_DEFAULTS.breakerMinSample, 10),
    harmMarginPp: clampNum(raw.harmMarginPp, DECIDE_V2_DEFAULTS.harmMarginPp, 4, 20),
    hardNegCeilingPct: clampNum(raw.hardNegCeilingPct, DECIDE_V2_DEFAULTS.hardNegCeilingPct, 15, 50),
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function decideExperimentV2(
  champion: VariantOutcome,
  challenger: VariantOutcome,
  options?: DecideV2Options
): ExperimentVerdict {
  const o = { ...DECIDE_V2_DEFAULTS, ...options };

  // 1. Do-no-harm circuit breaker — FIRST, independent of any e-value or lift.
  const breakerVerdict = checkCircuitBreaker(champion, challenger, o);
  if (breakerVerdict) return breakerVerdict;

  // 2. Evidence gate: anytime-valid e-value vs 1/alpha. No minimum-n floor — a small n simply
  //    can't reach threshold, so this IS the sample-size gate.
  const e = eValueTwoProportions(champion, challenger);
  const threshold = 1 / o.alpha;
  if (e < threshold) {
    return {
      decision: "keep_running",
      reason: `evidence ${round1(e)} of ${round1(threshold)} needed`,
    };
  }

  // 3. Posterior read of size + direction: a practical win must also clear the expected-loss
  //    ceiling before it's recommended for adoption.
  const { medianLiftPp, expectedAdoptionLossPp } = posteriorSummary(champion, challenger, o.rng);

  if (medianLiftPp >= o.minEffectPp && expectedAdoptionLossPp <= o.maxAdoptionLossPp) {
    return {
      decision: "adopt_challenger",
      reason: `challenger wins by ${round1(medianLiftPp)}pp (evidence ${round1(e)}, expected adoption loss ${round3(expectedAdoptionLossPp)}pp)`,
    };
  }

  if (medianLiftPp <= -o.minEffectPp) {
    return {
      decision: "discard_challenger",
      reason: `champion holds — challenger trails by ${round1(Math.abs(medianLiftPp))}pp (evidence ${round1(e)})`,
    };
  }

  return {
    decision: "keep_running",
    reason: `difference confirmed (evidence ${round1(e)}, lift ${round1(medianLiftPp)}pp, expected adoption loss ${round3(expectedAdoptionLossPp)}pp) but not a practical winner yet`,
  };
}
