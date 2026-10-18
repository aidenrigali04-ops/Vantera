import { mulberry32 } from "../optimize/sim/harness";
import { ARENAS, type ArenaKey } from "../hive/arenas";
import type { Genome } from "../hive/genome";
import { FAMILIES, generateWorld, meetingsPerSourced, stageProbs, type Family, type World, type WorldRanges } from "../hive/sim/world";

/**
 * The Governor's evaluator — the only thing in the research layer that ever touches a world's
 * hidden truth. Brains submit a STRATEGY (one genome per arena) and get back a scalar with an
 * interval and nothing else. World seeds are derived from a secret salt the brains never see, so a
 * brain can't tune to a world it can query, and the sealed holdout salt is never used for anything
 * but the final verdict.
 *
 * Score = expected meetings per 100 sourced prospects (the business objective), minus a harm
 * penalty: every opt-out / negative reply counts against the strategy at HARM_WEIGHT meetings
 * each, so "win by annoying everyone" can't score. Averaged over every account in every world.
 */

export type Strategy = Partial<Record<ArenaKey, Genome>>;

export type EvalResult = {
  /** per-world scores in a fixed order, so two strategies evaluated on the same set can be PAIRED */
  perWorld: number[];
  /** mean score across worlds (meetings per 100 sourced, harm-adjusted) */
  score: number;
  /** half-width of a 90% interval over worlds (normal approx) */
  margin: number;
  /** the worst family's mean — robustness rank uses this, never the average */
  worst: number;
  worstFamily: Family;
  /** per-family means, for the viewer and the audit */
  byFamily: Record<string, number>;
  /** raw negative-reply rate per sourced unit (what the harm penalty was applied to) */
  harmRate: number;
  worlds: number;
};

export const HARM_WEIGHT = 0.5;

/** Score one strategy on one world (all accounts, both sources). */
function scoreWorld(w: World, strategy: Strategy, day: number): { score: number; harm: number } {
  let s = 0;
  let h = 0;
  for (const acct of w.accounts) {
    for (const source of ["icp", "intent"] as const) {
      const g: Strategy = {};
      for (const arena of Object.keys(ARENAS) as ArenaKey[]) {
        if (!ARENAS[arena].appliesToUnit({ source })) continue;
        if (strategy[arena]) g[arena] = strategy[arena];
      }
      const p = stageProbs(w, acct, g, day);
      const share = source === "intent" ? acct.intentShare : 1 - acct.intentShare;
      const meetings = meetingsPerSourced(p) * 100;
      const negPerSourced = p.qual * p.acc * p.neg * 100;
      s += share * (meetings - HARM_WEIGHT * negPerSourced);
      h += share * negPerSourced;
    }
  }
  return { score: s / w.accounts.length, harm: h / w.accounts.length };
}

export type WorldSet = {
  salt: number;
  perFamily: number;
  accounts: number;
  horizonDays: number;
  families?: Family[];
  /** When set, base rates come from a fitted cohort instead of the assumed ranges. */
  ranges?: WorldRanges;
};

const worldCache = new Map<string, World>();

/** Drop cached worlds. Scores stay deterministic; this only frees memory between hives. */
export function releaseWorldCache(): void {
  worldCache.clear();
}
function rangeKey(ranges: WorldRanges | undefined): string {
  if (!ranges) return "";
  return (Object.keys(ranges) as (keyof WorldRanges)[]).map((k) => `${k}:${ranges[k][0]}-${ranges[k][1]}`).join("|");
}
function worldFor(set: WorldSet, family: Family, i: number, arenas: ArenaKey[]): World {
  const seed = (Math.imul(set.salt ^ 0x9e3779b9, 2654435761) + FAMILIES.indexOf(family) * 7919 + i * 104729) >>> 0;
  const key = `${seed}|${set.accounts}|${set.horizonDays}|${arenas.join(",")}|${rangeKey(set.ranges)}`;
  let w = worldCache.get(key);
  if (!w) {
    w = generateWorld({ seed, family, accounts: set.accounts, horizonDays: set.horizonDays, arenas, ranges: set.ranges });
    worldCache.set(key, w);
  }
  return w;
}

/**
 * Evaluate a strategy on a world set. Drift worlds are scored at both epochs (before and after the
 * drift day) so a strategy has to hold up when the truth moves.
 */
export function evaluate(strategy: Strategy, set: WorldSet, arenas: ArenaKey[] = Object.keys(ARENAS) as ArenaKey[]): EvalResult {
  const families = set.families ?? FAMILIES;
  const scores: number[] = [];
  const byFamily: Record<string, number> = {};
  let harmSum = 0;
  let n = 0;
  for (const family of families) {
    let fs = 0;
    let fn = 0;
    for (let i = 0; i < set.perFamily; i++) {
      const w = worldFor(set, family, i, arenas);
      const days = w.driftDay !== null ? [0, w.driftDay] : [0];
      for (const d of days) {
        const r = scoreWorld(w, strategy, d);
        scores.push(r.score);
        harmSum += r.harm;
        fs += r.score;
        fn++;
        n++;
      }
    }
    byFamily[family] = fs / fn;
  }
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, scores.length - 1));
  let worst = Infinity;
  let worstFamily: Family = families[0]!;
  for (const f of families) {
    if (byFamily[f]! < worst) {
      worst = byFamily[f]!;
      worstFamily = f;
    }
  }
  return { perWorld: scores, score: mean, margin: (1.645 * sd) / Math.sqrt(scores.length), worst, worstFamily, byFamily, harmRate: harmSum / n, worlds: n };
}

/**
 * Paired comparison: the lift of `b` over `a` on the SAME worlds, with the 90% interval of the
 * per-world differences. World-to-world variation (which dwarfs most real effects) cancels, so the
 * same evidence gives a far tighter read than comparing two independent means. Both results must
 * come from the same WorldSet and arena list.
 */
export function pairedLift(a: EvalResult, b: EvalResult): { lift: number; margin: number } {
  if (a.perWorld.length !== b.perWorld.length || a.perWorld.length === 0) return { lift: b.score - a.score, margin: Infinity };
  const d = b.perWorld.map((x, i) => x - a.perWorld[i]!);
  const mean = d.reduce((s, x) => s + x, 0) / d.length;
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, d.length - 1));
  return { lift: mean, margin: (1.645 * sd) / Math.sqrt(d.length) };
}

/** A deterministic rng for anything the governor randomizes (never exposed to brains). */
export const governorRng = (salt: number) => mulberry32(salt ^ 0x7f4a7c15);
