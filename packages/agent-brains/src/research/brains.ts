import { sampleBeta } from "../optimize/bandit";
import { ARENAS, type ArenaKey } from "../hive/arenas";
import { diffGenes, oneGeneNeighbors, type Genome } from "../hive/genome";
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
  /** why the governor stopped this proposal; absent on entries written before feedback existed */
  reason?: string;
};

export type RawProposal = {
  strategy: Record<string, Genome>;
  hypothesis: string;
  mechanism: string;
  predictedLift: number;
  falsifyBelow: number;
};

export type BrainFeedback = { brain: BrainKind; proposalId: string; outcome: string };

export type BrainFn = (ctx: BrainContext, n: number) => RawProposal[] | Promise<RawProposal[]>;

export type BrainContext = {
  champion: Strategy;
  championScore: number;
  library: LibraryEntry[];
  arenas: ArenaKey[];
  generation: number;
  rand: () => number;
  /** the governor's elite archive: distinct strategies that cleared sealing, best first */
  elites: { strategy: Strategy; score: number }[];
  /** when set, brains may change only genes the live pipeline can apply */
  liveGenesOnly?: boolean;
  /** last rejection and verdict lines for this brain; only the deliberator reads them */
  feedback?: BrainFeedback[];
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

/** Crossover: combine every gene value that won before and was never raced together,
 *  and recombine ELITE strategies from the archive with the champion (lineage crossover). */
function crossover(ctx: BrainContext, n: number): RawProposal[] {
  const winners = ctx.library.filter((e) => e.verdict === "promoted" || e.lift > 0).flatMap((e) => e.changes);
  // Elite lineage differences count as winner material too.
  for (const e of ctx.elites.slice(1, 4)) {
    for (const arena of ctx.arenas) {
      const a = ctx.champion[arena]!, b = e.strategy[arena];
      if (!b) continue;
      for (const gene of diffGenes(a, b)) {
        winners.push({ arena, gene, from: a[gene]!, to: b[gene]! });
      }
    }
  }
  const tried = triedSignatures(ctx.library, ctx.champion);
  const out: RawProposal[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard++ < 60 && winners.length >= 2) {
    const span = new Set(winners.map((w) => `${w.arena}|${w.gene}`)).size;
    if (span < 2) break;
    const k = 2 + Math.floor(ctx.rand() * (span - 1));
    const pick: typeof winners = [];
    const usedGene = new Set<string>();
    for (let i = 0; i < 40 && pick.length < k; i++) {
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

/** Specialist: rewrites a whole arena in one idea, moving every gene off the champion together. */
function specialist(ctx: BrainContext, n: number): RawProposal[] {
  const tried = triedSignatures(ctx.library, ctx.champion);
  const out: RawProposal[] = [];
  const arenas = [...ctx.arenas].sort(() => ctx.rand() - 0.5);
  for (const arena of arenas) {
    if (out.length >= n) break;
    const champ = ctx.champion[arena]!;
    const moves: { gene: string; to: string }[] = [];
    for (const [gene, spec] of Object.entries(ARENAS[arena].genes)) {
      const alts = spec.values.filter((v) => v !== champ[gene]);
      if (!alts.length) continue;
      moves.push({ gene, to: alts[Math.floor(ctx.rand() * alts.length)]! });
    }
    if (moves.length < 2) continue;
    const sig = moves.map((m) => keyOf(arena, m.gene, m.to)).sort().join(";");
    if (tried.has(sig)) continue;
    const next = { ...champ };
    for (const m of moves) next[m.gene] = m.to;
    out.push({
      strategy: { [arena]: next },
      hypothesis: `Within ${ARENAS[arena].label.toLowerCase()}, ${moves.map((m) => `${label(m.gene)}=${human(m.to)}`).join(" and ")} work as one move.`,
      mechanism: `Specialist on one arena: tests the whole interaction a single-gene move can't reveal.`,
      ...predicted(ctx.championScore, undefined, ctx.rand),
    });
  }
  return out.slice(0, n);
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

type Supported = { arena: ArenaKey; gene: string; to: string; mean: number; tried: number };

/** Best measured value per gene on this account's library. One account, one record. */
function supportedValues(ctx: BrainContext): Supported[] {
  const ev = geneEvidence(ctx.library);
  const best = new Map<string, Supported>();
  for (const [key, e] of ev) {
    const mean = e.liftSum / e.tried;
    if (!(mean > 0) || e.tried < 1) continue;
    const bar = key.indexOf("|");
    const eq = key.indexOf("=");
    if (bar < 0 || eq < 0) continue;
    const arena = key.slice(0, bar) as ArenaKey;
    const gene = key.slice(bar + 1, eq);
    const to = key.slice(eq + 1);
    if (!ctx.arenas.includes(arena)) continue;
    if (ctx.champion[arena]?.[gene] === to) continue;
    const id = `${arena}|${gene}`;
    const cur = best.get(id);
    if (!cur || mean > cur.mean) best.set(id, { arena, gene, to, mean, tried: e.tried });
  }
  return [...best.values()].sort((a, b) => b.mean - a.mean);
}

function portfolio(ctx: BrainContext, pick: Supported[]): RawProposal | null {
  if (pick.length === 0) return null;
  const tried = triedSignatures(ctx.library, ctx.champion);
  const sig = pick.map((c) => keyOf(c.arena, c.gene, c.to)).sort().join(";");
  if (tried.has(sig)) return null;
  const strategy: Record<string, Genome> = {};
  for (const c of pick) strategy[c.arena] = { ...(strategy[c.arena] ?? ctx.champion[c.arena]!), [c.gene]: c.to };
  const sum = pick.reduce((s, c) => s + c.mean, 0);
  return {
    strategy,
    hypothesis: `This account's measured winners — ${pick.map((c) => `${label(c.gene)}=${human(c.to)}`).join(", ")} — should compound.`,
    mechanism: `Strategist: each value has a positive mean lift on this account's own record. The combination is a forecast. Only a measured verdict can adopt it.`,
    predictedLift: Math.max(0.01, sum * 0.6),
    falsifyBelow: 0,
  };
}

/**
 * Strategist: assembles this account's best supported strategy from its own verdicts.
 * It never sees a world and never supplies the score. Empty labels are not proposals.
 */
function strategist(ctx: BrainContext, n: number): RawProposal[] {
  if (n <= 0) return [];
  const ranked = supportedValues(ctx);
  const out: RawProposal[] = [];
  const full = portfolio(ctx, ranked);
  if (full) out.push(full);
  for (const size of [2, 3]) {
    if (out.length >= n || ranked.length < size) continue;
    const slice = portfolio(ctx, ranked.slice(0, size));
    if (slice) out.push(slice);
  }
  const elite = ctx.elites.find((e) => e.score > ctx.championScore + 1e-9);
  if (elite && out.length < n) {
    const pick: Supported[] = [];
    for (const arena of ctx.arenas) {
      const base = ctx.champion[arena];
      const alt = elite.strategy[arena];
      if (!base || !alt) continue;
      for (const gene of Object.keys(base)) {
        if (base[gene] !== alt[gene] && alt[gene]) pick.push({ arena, gene, to: alt[gene]!, mean: Math.max(0.01, elite.score - ctx.championScore), tried: 1 });
      }
    }
    const packed = portfolio(ctx, pick);
    if (packed) out.push(packed);
  }
  return out.slice(0, n);
}

export const BRAINS: Record<Exclude<BrainKind, "deliberator">, BrainFn> = {
  mutator, crossover, contrarian, specialist, scientist, strategist,
};

export const BRAIN_KINDS = Object.keys(BRAINS) as Exclude<BrainKind, "deliberator">[];

export const BRAIN_DESCRIPTION: Record<BrainKind, string> = {
  mutator: "Moves one gene at a time, ranked by this account's record for each value.",
  crossover: "Combines values that each won on this account, with no cap on how many move together.",
  contrarian: "Explores values this account has not tested yet.",
  specialist: "Rewrites one whole aspect at a time, moving every gene in it together.",
  scientist: "Replicates the strongest measured effects the champion doesn't have yet.",
  strategist: "Assembles this account's best supported strategy from its own measured winners. The governor's verdict is the only result.",
  deliberator: "The language strategist. It proposes from this account's record. The governor's measured verdict is the only result.",
};
