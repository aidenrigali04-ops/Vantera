import { ARENAS, type ArenaKey } from "./arenas";

/**
 * Genomes: a full assignment of every gene in an arena to one of its closed values. Always FULL —
 * a challenger is the champion with gene(s) changed, never a partial dict. (The legacy loop stores
 * partial CopyStrategy dicts, so its challenger arm drops the champion's other knobs and adoption
 * forgets earlier wins; full genomes make that impossible by construction.) Pure.
 */
export type Genome = Record<string, string>;

/** Canonical signature: genes sorted, values joined. Stable across key order. */
export function genomeSignature(arena: ArenaKey, g: Genome): string {
  return `${arena}|${Object.keys(g)
    .sort()
    .map((k) => `${k}=${g[k]}`)
    .join(";")}`;
}

/**
 * Strict validation against the arena's closed gene sets. Returns a normalized full genome, or
 * null if ANY gene is unknown or ANY value is outside its set. Missing genes are filled from
 * `base` (the champion), so a proposal may name only what it changes.
 */
export function validateGenome(arena: ArenaKey, proposal: unknown, base: Genome): Genome | null {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return null;
  const spec = ARENAS[arena].genes;
  const out: Genome = { ...base };
  for (const [k, v] of Object.entries(proposal as Record<string, unknown>)) {
    const gene = spec[k];
    if (!gene) return null;
    if (typeof v !== "string" || !gene.values.includes(v)) return null;
    out[k] = v;
  }
  for (const k of Object.keys(spec)) if (!(k in out)) return null;
  return out;
}

/** Genes on which two genomes differ. */
export function diffGenes(a: Genome, b: Genome): string[] {
  return Object.keys(a).filter((k) => a[k] !== b[k]);
}

/** Every genome exactly one gene away from `g`, restricted to `allowedGenes` when given. */
export function oneGeneNeighbors(arena: ArenaKey, g: Genome, allowedGenes?: string[]): Genome[] {
  const out: Genome[] = [];
  for (const [k, spec] of Object.entries(ARENAS[arena].genes)) {
    if (allowedGenes && !allowedGenes.includes(k)) continue;
    for (const v of spec.values) if (v !== g[k]) out.push({ ...g, [k]: v });
  }
  return out;
}

/**
 * Crossover: start from `champion`, take ONE gene from `donor` where they differ (keeps every
 * challenger attributable to a single change). Returns null when the donor adds nothing.
 */
export function crossoverOne(champion: Genome, donor: Genome, rand: () => number, allowedGenes?: string[]): Genome | null {
  const diffs = diffGenes(champion, donor).filter((k) => !allowedGenes || allowedGenes.includes(k));
  if (diffs.length === 0) return null;
  const k = diffs[Math.floor(rand() * diffs.length)]!;
  return { ...champion, [k]: donor[k]! };
}

/** Enumerate an arena's full genome space (used by the simulator's oracle; spaces are small). */
export function enumerateGenomes(arena: ArenaKey): Genome[] {
  let acc: Genome[] = [{}];
  for (const [k, spec] of Object.entries(ARENAS[arena].genes)) {
    const next: Genome[] = [];
    for (const g of acc) for (const v of spec.values) next.push({ ...g, [k]: v });
    acc = next;
  }
  return acc;
}
