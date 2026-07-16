import { DECIDE_DEFAULTS, decideExperiment } from "../decide";
import type { DecideOptions, ExperimentDecision, VariantOutcome } from "../decide";

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
    const verdict = decideExperiment(champ, chal, c.decideOptions ?? DECIDE_DEFAULTS);
    if (verdict.decision !== "keep_running") return { decision: verdict.decision, day };
  }
  return { decision: "keep_running", day: c.horizonDays };
}

export function runMonteCarlo(
  runs: number,
  seed: number,
  config: Omit<SimConfig, "rng">
): { adoptRate: number; discardRate: number; haltRate: number; inconclusiveRate: number; meanDecisionDay: number } {
  const rng = mulberry32(seed);
  let adopt = 0, discard = 0, halt = 0, inconclusive = 0, daySum = 0, decided = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateDecisionPath({ ...config, rng });
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
