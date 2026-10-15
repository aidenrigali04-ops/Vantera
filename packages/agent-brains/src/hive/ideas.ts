import { sampleBeta } from "../optimize/bandit";
import type { ArenaKey } from "./arenas";
import type { HiveConfig } from "./config";
import { crossoverOne, diffGenes, genomeSignature, oneGeneNeighbors, validateGenome, type Genome } from "./genome";
import type { VariantOrigin } from "./container";
import type { ArmCounts } from "./outcome";

/**
 * Idea generation for the next container: expansive, but every idea is a valid, single-change,
 * never-yet-failed genome. Three sources feed one pool:
 *   1. mutation   — every one-gene neighbor of the champion (exhaustive over the closed space);
 *   2. crossover  — one gene borrowed from a genome that WON for another account (the hive);
 *   3. llm        — optional model proposals, accepted only if they parse to a valid genome that
 *                   differs from the champion in exactly one gene. Free text never survives.
 * The pool is then ranked by a Thompson draw on the pooled cross-account evidence for each genome
 * (shrunk toward the arena's pooled rate), so ideas with real support rise and untested ones still
 * get explored. Pure; RNG injected.
 */

export type LibraryStats = Map<string, ArmCounts>;

export type IdeaContext = {
  arena: ArenaKey;
  champion: Genome;
  /** genes this environment may change (live = wired genes only; simulator = all) */
  allowedGenes?: string[];
  /** signatures this account already saw fail (killed/halted) in the current epoch */
  failedForAccount: Set<string>;
  /** genomes that won promotions for OTHER accounts on this arena */
  donors: Genome[];
  /** pooled outcome counts per genome signature across accounts (anonymized aggregates only) */
  library: LibraryStats;
  /** raw model proposals (already parsed JSON), optional */
  llmProposals?: unknown[];
};

export type Idea = { genome: Genome; origin: VariantOrigin };

function pooledRate(lib: LibraryStats, arena: ArenaKey): number {
  let d = 0;
  let s = 0;
  for (const [sig, c] of lib) {
    if (!sig.startsWith(`${arena}|`)) continue;
    d += c.denominator;
    s += c.successes;
  }
  return d > 0 ? s / d : 0;
}

export function proposeIdeas(ctx: IdeaContext, cfg: HiveConfig, rand: () => number): Idea[] {
  const champSig = genomeSignature(ctx.arena, ctx.champion);
  const seen = new Set<string>([champSig]);
  const pool: Idea[] = [];
  const add = (g: Genome | null, origin: VariantOrigin) => {
    if (!g) return;
    const changed = diffGenes(ctx.champion, g);
    if (changed.length !== 1) return; // single-change attribution, always
    if (ctx.allowedGenes && !ctx.allowedGenes.includes(changed[0]!)) return;
    const sig = genomeSignature(ctx.arena, g);
    if (seen.has(sig) || ctx.failedForAccount.has(sig)) return;
    seen.add(sig);
    pool.push({ genome: g, origin });
  };

  // LLM proposals first so a valid model idea keeps its origin label when it duplicates a mutation.
  for (const p of ctx.llmProposals ?? []) add(validateGenome(ctx.arena, p, ctx.champion), "llm");

  const crossovers: Genome[] = [];
  for (const donor of ctx.donors) {
    const g = crossoverOne(ctx.champion, donor, rand, ctx.allowedGenes);
    if (g) crossovers.push(g);
  }
  for (const g of crossovers) add(g, "crossover");
  for (const g of oneGeneNeighbors(ctx.arena, ctx.champion, ctx.allowedGenes)) add(g, "mutation");

  if (pool.length === 0) return [];

  // Thompson rank on pooled evidence. Unseen genomes keep a flat prior (exploration).
  const p = pooledRate(ctx.library, ctx.arena);
  const m = cfg.shrinkM;
  const scored = pool.map((idea) => {
    const c = ctx.library.get(genomeSignature(ctx.arena, idea.genome));
    const n = c?.denominator ?? 0;
    const k = c?.successes ?? 0;
    const a = n > 0 ? 1 + k + m * p : 1;
    const b = n > 0 ? 1 + (n - k) + m * (1 - p) : 1;
    return { idea, draw: sampleBeta(a, b, rand) };
  });
  scored.sort((x, y) => y.draw - x.draw);

  // Reserve crossover slots so the hive's winners get raced even when unseen mutations draw high.
  const k = cfg.challengersPerContainer;
  const crossSlots = Math.min(k, Math.round(k * cfg.crossoverShare));
  const out: Idea[] = [];
  const usedGenes = new Set<string>();
  const take = (filter: (i: Idea) => boolean, limit: number) => {
    for (const { idea } of scored) {
      if (out.length >= k || limit <= 0) break;
      if (out.includes(idea) || !filter(idea)) continue;
      // Prefer distinct genes per container, so one container tests different levers.
      const gene = diffGenes(ctx.champion, idea.genome)[0]!;
      if (usedGenes.has(gene) && scored.some((s) => !out.includes(s.idea) && !usedGenes.has(diffGenes(ctx.champion, s.idea.genome)[0]!))) continue;
      usedGenes.add(gene);
      out.push(idea);
      limit--;
    }
  };
  take((i) => i.origin === "crossover", crossSlots);
  take(() => true, k);
  for (const { idea } of scored) {
    if (out.length >= k) break;
    if (!out.includes(idea)) out.push(idea);
  }
  return out;
}
