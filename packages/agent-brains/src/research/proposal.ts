import { ARENAS, type ArenaKey } from "../hive/arenas";
import { genomeSignature, type Genome } from "../hive/genome";
import type { Strategy } from "./evaluator";

/**
 * A research proposal is PRE-REGISTERED: the brain commits to what it changes, why, and the
 * prediction that would falsify it BEFORE the governor runs anything. The governor never lets a
 * brain revise a proposal after submission — that is the control that makes goalpost-moving
 * impossible. Proposals may touch several arenas at once, and they may name a gene or a value
 * the catalog does not list. A value with no planted response adds nothing when scored, so the
 * idea can be tried without becoming a win the evaluator did not measure.
 */

export type BrainKind = "mutator" | "crossover" | "contrarian" | "specialist" | "scientist" | "strategist" | "deliberator";

export type Proposal = {
  id: string;
  brain: BrainKind;
  brainId: string;
  generation: number;
  /** the strategy under test — full genome per touched arena */
  strategy: Strategy;
  /** which (arena, gene) pairs differ from the champion */
  changes: { arena: ArenaKey; gene: string; from: string; to: string }[];
  hypothesis: string;
  mechanism: string;
  /** predicted lift over the champion, in meetings per 100 sourced */
  predictedLift: number;
  /** the pre-registered falsifier: lift below this means the hypothesis is wrong */
  falsifyBelow: number;
  submittedTick: number;
};

export type ValidationError = { code: "unknown_arena" | "invalid_genome" | "no_change" | "missing_prediction" | "bad_falsifier"; detail: string };

/** A genome is a map of gene names to non-empty values. Shape only — the catalog is not a cage. */
function asGenome(g: unknown): Genome | null {
  if (!g || typeof g !== "object" || Array.isArray(g)) return null;
  const out: Genome = {};
  for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
    if (!k.trim() || typeof v !== "string" || !v.trim()) return null;
    out[k] = v;
  }
  return out;
}

/**
 * Accepts any well-formed idea. The governor rules on the measured result. Malformed genomes are
 * refused and never coerced into a value. A missing forecast or a falsifier that cannot fail is
 * refused, because those are how a brain would submit a result instead of a prediction.
 */
export function validateProposal(raw: {
  strategy: Record<string, unknown>;
  hypothesis?: string;
  mechanism?: string;
  predictedLift?: number;
  falsifyBelow?: number;
}, champion: Strategy): { ok: true; strategy: Strategy; changes: Proposal["changes"] } | { ok: false; error: ValidationError } {
  const strategy: Strategy = {};
  const changes: Proposal["changes"] = [];
  for (const [arena, g] of Object.entries(raw.strategy)) {
    const proposed = asGenome(g);
    if (!proposed) return { ok: false, error: { code: "invalid_genome", detail: `${arena}: genome must map gene names to values` } };
    const known = arena in ARENAS;
    const base = known ? champion[arena as ArenaKey] : undefined;
    if (known && !base) return { ok: false, error: { code: "unknown_arena", detail: `${arena} has no champion` } };
    // Known arenas keep every champion gene the proposal does not mention, then apply the idea.
    // An arena the funnel has no stage for is recorded as a change and left off the scored
    // strategy: there is no planted response to invent, so the measurement stays the champion's.
    const next: Genome = { ...(base ?? {}) };
    for (const [gene, value] of Object.entries(proposed)) next[gene] = value;
    const genes = new Set([...Object.keys(base ?? {}), ...Object.keys(next)]);
    for (const gene of genes) {
      const from = base?.[gene] ?? "";
      const to = next[gene];
      if (to === undefined || to === from) continue;
      changes.push({ arena: arena as ArenaKey, gene, from, to });
    }
    if (known) strategy[arena as ArenaKey] = next;
  }
  if (changes.length === 0) return { ok: false, error: { code: "no_change", detail: "identical to the champion" } };
  if (typeof raw.predictedLift !== "number" || !Number.isFinite(raw.predictedLift)) return { ok: false, error: { code: "missing_prediction", detail: "predictedLift required" } };
  if (typeof raw.falsifyBelow !== "number" || !Number.isFinite(raw.falsifyBelow) || raw.falsifyBelow > raw.predictedLift) {
    return { ok: false, error: { code: "bad_falsifier", detail: "falsifyBelow must be a number <= predictedLift" } };
  }
  return { ok: true, strategy, changes };
}

/** Full strategy = champion with the proposal's arenas replaced. */
export function mergeStrategy(champion: Strategy, partial: Strategy): Strategy {
  return { ...champion, ...partial };
}

export function strategySignature(s: Strategy): string {
  return (Object.keys(s) as ArenaKey[])
    .sort()
    .map((a) => genomeSignature(a, s[a] as Genome))
    .join("||");
}
