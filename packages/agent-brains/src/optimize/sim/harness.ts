import { DECIDE_DEFAULTS, decideExperiment } from "../decide";
import type { DecideOptions, ExperimentDecision, ExperimentVerdict, VariantOutcome } from "../decide";

/**
 * Seeded monte-carlo testbed for the decide gate (enterprise-grade-brain spec, WS-1.7).
 * Simulates the production evaluation pattern faithfully: outcomes accumulate daily and the
 * gate re-evaluates EVERY day (the cron's peeking included), so measured error rates are the
 * rates the real loop experiences. Pure TS + injected RNG — runs in vitest, no LLM, no DB.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function binomial(n: number, p: number, rng: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

export type SimConfig = {
  championRate: number;
  challengerRate: number;
  negativeRate: number;
  perDayPerArm: number;
  horizonDays: number;
  decideOptions?: DecideOptions;
  /**
   * Injectable decision function (enterprise-grade-brain Phase 2A, WS-1.7). Defaults to the
   * legacy `decideExperiment` when omitted — every pre-existing Phase-1 characterization test
   * passes this field as `undefined`, so it hits the exact same branch as before and stays
   * byte-identical. Pass `decideExperimentV2` (or any other pure decide fn) to calibrate a
   * replacement gate against the same daily-peeking simulation.
   *
   * The optional third param is `decideRng` (see below) — a stochastic decide fn (V2's posterior
   * Monte-Carlo read) takes it and forwards it as its own `{ rng }` option; a deterministic decide
   * fn (legacy `decideExperiment`) simply ignores it.
   */
  decideFn?: (c: VariantOutcome, t: VariantOutcome, decideRng?: () => number) => ExperimentVerdict;
  /**
   * Per-PATH rng stream for `decideFn`'s own randomness, supplied by `runMonteCarlo` (never by a
   * caller directly — see `Omit<SimConfig, "rng" | "decideRng">` on that signature). One rng
   * instance is created per simulated experiment path and threaded through EVERY day of that
   * path's horizon unchanged — never reconstructed inside the day loop. Reconstructing a fresh
   * `mulberry32(fixedSeed)` on every call (a real trap: the naive `decideFn: (c, t) =>
   * decideExperimentV2(c, t, { rng: mulberry32(99) })` shape) replays the IDENTICAL posterior-noise
   * sequence on every day of every run, silently correlating and biasing the calibration. Threading
   * one continuously-advancing stream per path avoids that while staying fully deterministic (same
   * seed + path index always reproduces the same path).
   */
  decideRng?: () => number;
  rng: () => number;
};
export type SimResult = { decision: ExperimentDecision; day: number };

export function simulateDecisionPath(c: SimConfig): SimResult {
  const champ: VariantOutcome = { denominator: 0, successes: 0, negatives: 0 };
  const chal: VariantOutcome = { denominator: 0, successes: 0, negatives: 0 };
  for (let day = 1; day <= c.horizonDays; day++) {
    champ.denominator += c.perDayPerArm;
    champ.successes += binomial(c.perDayPerArm, c.championRate, c.rng);
    champ.negatives += binomial(c.perDayPerArm, c.negativeRate, c.rng);
    chal.denominator += c.perDayPerArm;
    chal.successes += binomial(c.perDayPerArm, c.challengerRate, c.rng);
    chal.negatives += binomial(c.perDayPerArm, c.negativeRate, c.rng);
    const verdict = c.decideFn
      ? c.decideFn(champ, chal, c.decideRng)
      : decideExperiment(champ, chal, c.decideOptions ?? DECIDE_DEFAULTS);
    if (verdict.decision !== "keep_running") return { decision: verdict.decision, day };
  }
  return { decision: "keep_running", day: c.horizonDays };
}

/**
 * Derives a per-path seed from the batch seed + path index so every simulated path gets its own
 * independent-looking, fully deterministic rng stream (see `SimConfig.decideRng`). The golden-
 * ratio multiplier (`0x9e3779b9`, the same Fibonacci-hashing constant used by e.g. Boost's
 * `hash_combine`) spreads adjacent path indices apart so they don't produce visually-correlated
 * seeds; `mulberry32`'s own mixing then does the rest. Not cryptographic — just decorrelated
 * enough for Monte-Carlo path independence.
 */
function pathSeed(seed: number, pathIndex: number): number {
  return ((seed ^ 0x9e3779b9) + pathIndex * 2654435761) >>> 0;
}

export function runMonteCarlo(
  runs: number,
  seed: number,
  config: Omit<SimConfig, "rng" | "decideRng">
): { adoptRate: number; discardRate: number; haltRate: number; inconclusiveRate: number; meanDecisionDay: number } {
  const rng = mulberry32(seed);
  let adopt = 0, discard = 0, halt = 0, inconclusive = 0, daySum = 0, decided = 0;
  for (let i = 0; i < runs; i++) {
    // One dedicated decideRng stream per path (see SimConfig.decideRng) — undefined when there's
    // no decideFn, so the legacy branch (which never reads decideRng) is completely unaffected.
    const decideRng = config.decideFn ? mulberry32(pathSeed(seed, i)) : undefined;
    const r = simulateDecisionPath({ ...config, rng, decideRng });
    if (r.decision === "adopt_challenger") adopt++;
    else if (r.decision === "discard_challenger") discard++;
    else if (r.decision === "halt") halt++;
    else inconclusive++;
    if (r.decision !== "keep_running") { daySum += r.day; decided++; }
  }
  return {
    adoptRate: adopt / runs,
    discardRate: discard / runs,
    haltRate: halt / runs,
    inconclusiveRate: inconclusive / runs,
    meanDecisionDay: decided ? daySum / decided : 0,
  };
}
