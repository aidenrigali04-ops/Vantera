import type { CopyStrategy } from "../copy/shared";
import type { FunnelStageKey } from "./funnel";
import type { VariantOutcome } from "./decide";
import { aggregateArm, type LeadOutcomeFlags } from "./outcomes";

/**
 * Thompson-sampling challenger selection (Stage 1b). The bandit decides WHAT TO TEST NEXT —
 * the champion/challenger experiment, Wilson gate, and circuit breaker remain the unchanged
 * adjudicator of what wins. Stats come from Stage-1 recipe stamps aggregated across accounts:
 * aggregate patterns only (knobs + outcome booleans), never text. Pure; RNG injected.
 */

/** Canonical signature for a strategy — sorted keys, empty values dropped. */
export function strategySignature(s: CopyStrategy): string {
  const entries = Object.entries(s)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(entries);
}

/** Group per-message outcome flags by strategy signature into per-recipe VariantOutcomes. */
export function aggregateBySignature(
  stageKey: FunnelStageKey,
  rows: { strategy: CopyStrategy; flags: LeadOutcomeFlags }[]
): Map<string, VariantOutcome> {
  const groups = new Map<string, LeadOutcomeFlags[]>();
  for (const r of rows) {
    const sig = strategySignature(r.strategy);
    const list = groups.get(sig) ?? [];
    list.push(r.flags);
    groups.set(sig, list);
  }
  const out = new Map<string, VariantOutcome>();
  for (const [sig, flags] of groups) out.set(sig, aggregateArm(stageKey, flags));
  return out;
}

/** Standard normal via Box-Muller (rand-injected). */
function sampleNormal(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gamma(shape>0) via Marsaglia-Tsang (with the shape<1 boost). */
function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    const u = rand();
    return sampleGamma(shape + 1, rand) * Math.pow(u === 0 ? 1e-12 : u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = sampleNormal(rand);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rand();
    if (Math.log(u === 0 ? 1e-12 : u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

/** Beta sampler shared with the Stage-2 discovery allocator. */
export function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const a = sampleGamma(alpha, rand);
  const b = sampleGamma(beta, rand);
  return a / (a + b);
}

/**
 * Empirical-Bayes shrinkage strength (pseudo-observations) pulling a signature's Beta prior
 * toward the pooled GLOBAL stage rate before Thompson sampling. Evidence (bandit.test.ts, 500
 * seeded draws): a lucky 1-of-2 signature (unshrunk Beta(2,2)) beat a solid, real 30-of-100
 * signature (Beta(31,71)) in 381/500 draws (76%) — a 2-sample fluke routinely outranking 100 real
 * samples. At M = 25 that flips to 137/500 (27%): the larger, real sample now dominates.
 */
const SHRINK_M = 25;

/** Pooled success rate across every signature currently tracked in `stats` — the shrink target. */
function pooledRate(stats: Map<string, VariantOutcome>): number {
  let totalDenominator = 0;
  let totalSuccesses = 0;
  for (const o of stats.values()) {
    totalDenominator += o.denominator;
    totalSuccesses += o.successes;
  }
  return totalDenominator > 0 ? totalSuccesses / totalDenominator : 0;
}

/**
 * Pick the next challenger: shrink each candidate's (successes, failures) toward the pooled global
 * stage rate p̄ with SHRINK_M pseudo-observations — Beta(1 + k + M·p̄, 1 + (n−k) + M·(1−p̄)) — then
 * sample and take the max. Shrinkage is what keeps a signature with a handful of lucky/unlucky
 * observations from outranking one with real, larger-sample evidence (see SHRINK_M's evidence
 * comment). Unseen candidates (no stats entry, or a zero-observation entry) keep the untouched
 * uniform Beta(1,1) prior — built-in exploration.
 */
export function chooseChallenger(
  candidates: CopyStrategy[],
  stats: Map<string, VariantOutcome>,
  rand: () => number
): CopyStrategy | null {
  if (candidates.length === 0) return null;
  const pooled = pooledRate(stats);
  let best: CopyStrategy | null = null;
  let bestDraw = -1;
  for (const c of candidates) {
    const o = stats.get(strategySignature(c));
    const successes = o?.successes ?? 0;
    const n = o?.denominator ?? 0;
    const failures = Math.max(0, n - successes);
    const alpha = n > 0 ? 1 + successes + SHRINK_M * pooled : 1;
    const beta = n > 0 ? 1 + failures + SHRINK_M * (1 - pooled) : 1;
    const draw = sampleBeta(alpha, beta, rand);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = c;
    }
  }
  return best;
}
