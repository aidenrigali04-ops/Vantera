import { sampleBeta } from "../optimize/bandit";
import { ARENAS, type ArenaKey } from "../hive/arenas";
import { diffGenes, genomeSignature, oneGeneNeighbors, type Genome } from "../hive/genome";
import type { Strategy } from "./evaluator";
import type { BrainKind } from "./proposal";

/**
 * The brains — independent proposers with different search styles. They see ONLY what the
 * governor publishes: the current champion, the shared verdict library (every past proposal with
 * its score, interval and verdict), and their own track record. Never a world, never the truth,
 * never the evaluator. Each emits raw proposals; the governor validates and pre-registers them.
 * Pure; RNG injected.
 */

export type Verdict = "promoted" | "rejected" | "falsified" | "flagged";

export type LibraryEntry = {
  id: string;
  brain: BrainKind;
  changes: { arena: ArenaKey; gene: string; from: string; to: string }[];
  lift: number;
  margin: number;
  worstLift: number;
  verdict: Verdict;
  generation: number;
};

export type RawProposal = {
  strategy: Record<string, Genome>;
  hypothesis: string;
  mechanism: string;
  predictedLift: number;
  falsifyBelow: number;
};

export type BrainContext = {
  champion: Strategy;
  championScore: number;
  library: LibraryEntry[];
  arenas: ArenaKey[];
  generation: number;
  rand: () => number;
  /** the governor's elite archive: distinct strategies that cleared sealing, best first */
  elites: { strategy: Strategy; score: number }[];
};

const GENE_LABEL: Record<string, string> = {
  icpFocus: "ICP focus", seniorityTilt: "seniority tilt", companySize: "company size", signalFreshnessDays: "signal freshness",
  watchTarget: "watch target", minIntentLevel: "min intent level", signalKind: "signal kind", recencyDays: "recency window",
  minScore: "qualification bar", tiltStrength: "tilt strength", openWith: "opener", angleFamily: "angle", messageShape: "message shape",
  followupLength: "follow-up length", touches: "touch count", touchGapDays: "touch spacing", askStyle: "ask style",
  bookingMode: "booking mode", objectionStyle: "objection handling", preMeetingBrief: "pre-meeting brief", reminderTiming: "reminders",
};
const label = (g: string) => GENE_LABEL[g] ?? g;
const human = (v: string) => v.replace(/_/g, " ");

/** Evidence per (arena, gene, value) from the library: how often that change helped. */
type GeneEvidence = Map<string, { tried: number; won: number; liftSum: number }>;
function geneEvidence(lib: LibraryEntry[]): GeneEvidence {
  const m: GeneEvidence = new Map();
  for (const e of lib) {
    for (const c of e.changes) {
      const k = `${c.arena}|${c.gene}=${c.to}`;
      const cur = m.get(k) ?? { tried: 0, won: 0, liftSum: 0 };
      cur.tried++;
      if (e.verdict === "promoted") cur.won++;
      cur.liftSum += e.lift;
      m.set(k, cur);
    }
  }
  return m;
}

const triedSignatures = (lib: LibraryEntry[], champion: Strategy) =>
  new Set(lib.map((e) => e.changes.map((c) => `${c.arena}|${c.gene}=${c.to}`).sort().join(";")));

function predicted(champScore: number, ev: { tried: number; liftSum: number } | undefined, rand: () => number): { predictedLift: number; falsifyBelow: number } {
  // A brain's forecast: prior from the library when it has one, otherwise a modest guess.
  const base = ev && ev.tried > 0 ? ev.liftSum / ev.tried : 0.04 * champScore;
  const predictedLift = Math.max(0.01, base * (0.6 + 0.8 * rand()));
  return { predictedLift, falsifyBelow: 0 };
}

function keyOf(arena: ArenaKey, gene: string, to: string) {
  return `${arena}|${gene}=${to}`;
}

/** Mutator: one-gene neighbors of the champion, Thompson-ranked on library evidence. */
function mutator(ctx: BrainContext, n: number): RawProposal[] {
  const ev = geneEvidence(ctx.library);
  const tried = triedSignatures(ctx.library, ctx.champion);
  const cands: { arena: ArenaKey; g: Genome; gene: string; draw: number }[] = [];
  for (const arena of ctx.arenas) {
    const champ = ctx.champion[arena]!;
    for (const g of oneGeneNeighbors(arena, champ)) {
      const gene = diffGenes(champ, g)[0]!;
      const k = keyOf(arena, gene, g[gene]!);
      if (tried.has(k)) continue;
      const e = ev.get(k);
      const a = 1 + (e?.won ?? 0), b = 1 + ((e?.tried ?? 0) - (e?.won ?? 0));
      // Untested moves get a small bonus so the search eventually sweeps the whole neighborhood.
      cands.push({ arena, g, gene, draw: sampleBeta(a, b, ctx.rand) + (e ? 0 : 0.15) });
    }
  }
  cands.sort((x, y) => y.draw - x.draw);
  return cands.slice(0, n).map((c) => ({
    strategy: { [c.arena]: c.g },
    hypothesis: `Setting ${label(c.gene)} to ${human(c.g[c.gene]!)} raises meetings for ${ARENAS[c.arena].label.toLowerCase()}.`,
    mechanism: `One-gene move from the champion; chosen by Thompson draw on the library's record for this value.`,
    ...predicted(ctx.championScore, ev.get(keyOf(c.arena, c.gene, c.g[c.gene]!)), ctx.rand),
  }));
}

/** Crossover: combine two or three gene values that each won before but were never raced together,
 *  and recombine ELITE strategies from the archive with the champion (lineage crossover). */
function crossover(ctx: BrainContext, n: number): RawProposal[] {
  const winners = ctx.library.filter((e) => e.verdict === "promoted" || e.lift > 0).flatMap((e) => e.changes);
  // Elite lineage differences count as winner material too.
  for (const e of ctx.elites.slice(1, 4)) {
    for (const arena of ctx.arenas) {
      const a = ctx.champion[arena]!, b = e.strategy[arena];
      if (!b) continue;
      for (const gene of diffGenes(a, b)) winners.push({ arena, gene, from: a[gene]!, to: b[gene]! });
    }
  }
  const tried = triedSignatures(ctx.library, ctx.champion);
  const out: RawProposal[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard++ < 60 && winners.length >= 2) {
    const k = 2 + (ctx.rand() < 0.3 ? 1 : 0);
    const pick: typeof winners = [];
    const usedGene = new Set<string>();
    for (let i = 0; i < 20 && pick.length < k; i++) {
      const w = winners[Math.floor(ctx.rand() * winners.length)]!;
      const gk = `${w.arena}|${w.gene}`;
      if (usedGene.has(gk)) continue;
      if (ctx.champion[w.arena]?.[w.gene] === w.to) continue; // already in the champion
      usedGene.add(gk);
      pick.push(w);
    }
    if (pick.length < 2) break;
    const sig = pick.map((c) => keyOf(c.arena, c.gene, c.to)).sort().join(";");
    if (seen.has(sig) || tried.has(sig)) continue;
    seen.add(sig);
    const strategy: Record<string, Genome> = {};
    for (const c of pick) strategy[c.arena] = { ...(strategy[c.arena] ?? ctx.champion[c.arena]!), [c.gene]: c.to };
    out.push({
      strategy,
      hypothesis: `Combining ${pick.map((c) => `${label(c.gene)}=${human(c.to)}`).join(" + ")} compounds their separate gains.`,
      mechanism: `Each value helped on its own in the library; this tests whether the gains add up when raced together.`,
      predictedLift: pick.reduce((s, c) => s + Math.max(0, ctx.library.find((e) => e.changes.some((x) => x.arena === c.arena && x.gene === c.gene && x.to === c.to))?.lift ?? 0), 0) * 0.7,
      falsifyBelow: 0,
    });
  }
  return out;
}

/** Contrarian: takes genes that LOST and tries the opposite direction, or a value no one tried. */
function contrarian(ctx: BrainContext, n: number): RawProposal[] {
  const ev = geneEvidence(ctx.library);
  const tried = triedSignatures(ctx.library, ctx.champion);
  const cands: { arena: ArenaKey; gene: string; to: string; untested: boolean }[] = [];
  for (const arena of ctx.arenas) {
    for (const [gene, spec] of Object.entries(ARENAS[arena].genes)) {
      const cur = ctx.champion[arena]![gene]!;
      for (const v of spec.values) {
        if (v === cur) continue;
        const k = keyOf(arena, gene, v);
        if (tried.has(k)) continue;
        cands.push({ arena, gene, to: v, untested: !ev.has(k) });
      }
    }
  }
  // Prefer values nobody has tested; the library's blind spots are where upside hides.
  cands.sort((a, b) => Number(b.untested) - Number(a.untested) || ctx.rand() - 0.5);
  return cands.slice(0, n).map((c) => ({
    strategy: { [c.arena]: { ...ctx.champion[c.arena]!, [c.gene]: c.to } },
    hypothesis: `${label(c.gene)}=${human(c.to)} is an untested blind spot; the champion's value may be a local optimum.`,
    mechanism: `Contrarian search: explores values the library has no evidence on, where the expected information gain is highest.`,
    ...predicted(ctx.championScore, undefined, ctx.rand),
  }));
}

/** Specialist: works one arena at a time, trying two coordinated changes inside it. */
function specialist(ctx: BrainContext, n: number): RawProposal[] {
  const tried = triedSignatures(ctx.library, ctx.champion);
  const out: RawProposal[] = [];
  const arenas = [...ctx.arenas].sort(() => ctx.rand() - 0.5);
  for (const arena of arenas) {
    if (out.length >= n) break;
    const champ = ctx.champion[arena]!;
    const genes = Object.keys(ARENAS[arena].genes);
    if (genes.length < 2) continue;
    const [g1, g2] = genes.sort(() => ctx.rand() - 0.5);
    const v1 = ARENAS[arena].genes[g1!]!.values.filter((v) => v !== champ[g1!]);
    const v2 = ARENAS[arena].genes[g2!]!.values.filter((v) => v !== champ[g2!]);
    if (!v1.length || !v2.length) continue;
    const a = v1[Math.floor(ctx.rand() * v1.length)]!, b = v2[Math.floor(ctx.rand() * v2.length)]!;
    const sig = [keyOf(arena, g1!, a), keyOf(arena, g2!, b)].sort().join(";");
    if (tried.has(sig)) continue;
    out.push({
      strategy: { [arena]: { ...champ, [g1!]: a, [g2!]: b } },
      hypothesis: `Within ${ARENAS[arena].label.toLowerCase()}, ${label(g1!)}=${human(a)} and ${label(g2!)}=${human(b)} work together.`,
      mechanism: `Specialist on one arena: tests an interaction a single-gene move can't reveal.`,
      ...predicted(ctx.championScore, undefined, ctx.rand),
    });
  }
  return out;
}

/** Scientist: reads the library for the biggest measured effects and re-proposes the best unexplored direction with a sharper prediction. */
function scientist(ctx: BrainContext, n: number): RawProposal[] {
  const ev = geneEvidence(ctx.library);
  const tried = triedSignatures(ctx.library, ctx.champion);
  const ranked = [...ev.entries()]
    .map(([k, e]) => ({ k, mean: e.liftSum / e.tried, tried: e.tried }))
    .filter((x) => x.mean > 0 && !tried.has(x.k))
    .sort((a, b) => b.mean - a.mean);
  const out: RawProposal[] = [];
  for (const r of ranked) {
    if (out.length >= n) break;
    const [arena, rest] = r.k.split("|") as [ArenaKey, string];
    const [gene, to] = rest.split("=") as [string, string];
    if (ctx.champion[arena]?.[gene] === to) continue;
    out.push({
      strategy: { [arena]: { ...ctx.champion[arena]!, [gene]: to } },
      hypothesis: `${label(gene)}=${human(to)} showed +${r.mean.toFixed(2)} across ${r.tried} past test(s); it should replicate against the current champion.`,
      mechanism: `Replication: the library's strongest measured effect not yet in the champion.`,
      predictedLift: r.mean * 0.8,
      falsifyBelow: r.mean * 0.2,
    });
  }
  return out;
}

export const BRAINS: Record<BrainKind, (ctx: BrainContext, n: number) => RawProposal[]> = {
  mutator, crossover, contrarian, specialist, scientist,
};

export const BRAIN_KINDS = Object.keys(BRAINS) as BrainKind[];

export const BRAIN_DESCRIPTION: Record<BrainKind, string> = {
  mutator: "Moves one gene at a time, ranked by the library's record for each value.",
  crossover: "Combines values that each won separately, testing whether gains add up.",
  contrarian: "Explores values no brain has tested yet; hunts the library's blind spots.",
  specialist: "Works one aspect at a time, testing two coordinated changes inside it.",
  scientist: "Replicates the strongest measured effects the champion doesn't have yet.",
};
