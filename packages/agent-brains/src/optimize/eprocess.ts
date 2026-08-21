import { sampleBeta } from "./bandit";

/**
 * E-process math (enterprise-grade-brain Phase 2A, WS-1.1). Pure numerics only: a log-space
 * Bayes-factor e-value for two proportions, plus Monte-Carlo posterior summaries. Consumers
 * (decideExperimentV2, the sim calibration gates) own threshold tuning and empirical
 * calibration — this module owns exact math and exhaustive unit coverage of that math.
 */

// Lanczos approximation, g=7, n=9 coefficients — the standard published constant set (as used
// by Numerical Recipes and the reference Wikipedia "Lanczos approximation" implementation).
// Valid directly for Re(x) >= 0.5; the reflection formula extends it below that.
const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
] as const;

/** Natural log of the Gamma function (Lanczos g=7, n=9). */
export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula: Gamma(x)*Gamma(1-x) = pi / sin(pi*x)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  const t = z + LANCZOS_G + 0.5;
  let a = 0;
  for (const [i, c] of LANCZOS_COEFFICIENTS.entries()) {
    a += i === 0 ? c : c / (z + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Natural log of the Beta function: logGamma(a) + logGamma(b) - logGamma(a+b). */
export function logBeta(a: number, b: number): number {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

type ArmCounts = { successes: number; denominator: number };

/**
 * Anytime-valid Bayes-factor e-value for two proportions: independent Beta(1,1) arms vs a
 * shared Beta(1,1) proportion, computed in log space (logB(1,1) = 0 terms vanish per the
 * task-4 brief). Valid under optional stopping/continuation for this sequential 2x2 design;
 * the sim suite (Task 6) is the empirical calibration authority for any threshold built on it.
 * Empty data (n0 = n1 = 0) returns exactly 1 (no evidence either way).
 */
export function eValueTwoProportions(champ: ArmCounts, chal: ArmCounts): number {
  const k0 = champ.successes;
  const n0 = champ.denominator;
  const k1 = chal.successes;
  const n1 = chal.denominator;

  const logBF =
    logBeta(1 + k0, 1 + n0 - k0) +
    logBeta(1 + k1, 1 + n1 - k1) -
    logBeta(1 + k0 + k1, 1 + (n0 + n1) - (k0 + k1));

  return Math.exp(logBF);
}

export type PosteriorSummary = {
  medianLiftPp: number;
  probChallengerBetter: number;
  expectedAdoptionLossPp: number;
};

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  const hi = sorted[mid] ?? 0;
  if (n % 2 !== 0) return hi;
  const lo = sorted[mid - 1] ?? 0;
  return (lo + hi) / 2;
}

/**
 * Monte-Carlo posterior summary from independent Beta(1+successes, 1+failures) arms. Draws are
 * paired per-iteration (same draw index feeds both champ and challenger samples) so lift and
 * adoption-loss are computed over the same joint posterior sample, not independently. All rates
 * are reported in percentage points. RNG is injectable (default Math.random); draws default 4000.
 */
export function posteriorSummary(
  champ: ArmCounts,
  chal: ArmCounts,
  rng: () => number = Math.random,
  draws = 4000
): PosteriorSummary {
  const a0 = 1 + champ.successes;
  const b0 = 1 + (champ.denominator - champ.successes);
  const a1 = 1 + chal.successes;
  const b1 = 1 + (chal.denominator - chal.successes);

  const lifts: number[] = new Array(draws);
  let winCount = 0;
  let lossSum = 0;

  for (let i = 0; i < draws; i++) {
    const p0 = sampleBeta(a0, b0, rng);
    const p1 = sampleBeta(a1, b1, rng);
    lifts[i] = (p1 - p0) * 100;
    if (p1 > p0) winCount++;
    lossSum += Math.max(p0 - p1, 0) * 100;
  }

  lifts.sort((x, y) => x - y);

  return {
    medianLiftPp: median(lifts),
    probChallengerBetter: winCount / draws,
    expectedAdoptionLossPp: lossSum / draws,
  };
}
