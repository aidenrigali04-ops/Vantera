import { ARENAS, type ArenaKey } from "../hive/arenas";
import { diffGenes, genomeSignature, validateGenome, type Genome } from "../hive/genome";
import type { Strategy } from "./evaluator";

/**
 * A research proposal is PRE-REGISTERED: the brain commits to what it changes, why, and the
 * prediction that would falsify it BEFORE the governor runs anything. The governor never lets a
 * brain revise a proposal after submission — that is the control that makes goalpost-moving
 * impossible. Proposals may touch several arenas at once (a strategy, not just a knob).
 */

export type BrainKind = "mutator" | "crossover" | "contrarian" | "specialist" | "scientist";

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

export type ValidationError = { code: "unknown_arena" | "invalid_genome" | "no_change" | "too_many_changes" | "missing_prediction" | "bad_falsifier"; detail: string };

export const MAX_CHANGES = 3;

/**
 * Strict validation against the closed gene sets. Anything a brain emits that isn't a legal value
 * is rejected here, with a reason the brain gets back (so it can learn), never silently coerced.
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
    if (!(arena in ARENAS)) return { ok: false, error: { code: "unknown_arena", detail: arena } };
    const base = champion[arena as ArenaKey];
    if (!base) return { ok: false, error: { code: "unknown_arena", detail: `${arena} has no champion` } };
    const v = validateGenome(arena as ArenaKey, g, base);
    if (!v) return { ok: false, error: { code: "invalid_genome", detail: `${arena}: ${JSON.stringify(g)}` } };
    for (const gene of diffGenes(base, v)) changes.push({ arena: arena as ArenaKey, gene, from: base[gene]!, to: v[gene]! });
    strategy[arena as ArenaKey] = v;
  }
  if (changes.length === 0) return { ok: false, error: { code: "no_change", detail: "identical to the champion" } };
  if (changes.length > MAX_CHANGES) return { ok: false, error: { code: "too_many_changes", detail: `${changes.length} > ${MAX_CHANGES}` } };
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
