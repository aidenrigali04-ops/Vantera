import { mulberry32 } from "../../optimize/sim/harness";
import { ARENAS, type ArenaKey } from "../arenas";
import type { Genome } from "../genome";

/**
 * Synthetic worlds for the Hive simulator: a hive of accounts plus a HIDDEN response model the
 * engine never sees. Effects live on the logit scale per funnel stage. Every range below is an
 * assumption, not Vantera data — calibrate WORLD_RANGES against real outcomes before trusting any
 * tuned config. Seeded and fully reproducible.
 */

export type Stage = "qual" | "acc" | "rep" | "neg" | "book" | "close";
export type Effect = Partial<Record<Stage, number>>;

export type Family =
  | "clear_winner"
  | "small_effect"
  | "no_winner"
  | "segment_flip"
  | "guardrail_trap"
  | "drift"
  | "thin_data"
  | "realistic_mix";

export const FAMILIES: Family[] = [
  "clear_winner",
  "small_effect",
  "no_winner",
  "segment_flip",
  "guardrail_trap",
  "drift",
  "thin_data",
  "realistic_mix",
];

export type SimAccount = {
  id: string;
  sourcedPerDay: number;
  intentShare: number;
  segment: 0 | 1;
  base: Record<Stage, number>;
};

export type World = {
  seed: number;
  family: Family;
  horizonDays: number;
  driftDay: number | null;
  accounts: SimAccount[];
  /** key `${arena}|${gene}=${value}` → effect (default values carry no effect) */
  effects: Map<string, Effect>;
  /** effects after driftDay (drift family only) */
  driftEffects: Map<string, Effect> | null;
  /** per-account deviations from the global effects */
  accountDev: Map<string, Map<string, Effect>>;
};

/** Assumed ranges. Base rates sit a bit below Vantera's own reference bands (funnel.ts) so there
 *  is headroom to find; tune these to real data. */
export const WORLD_RANGES = {
  qual: [0.35, 0.6],
  acc: [0.2, 0.4],
  rep: [0.06, 0.16],
  neg: [0.02, 0.06],
  book: [0.25, 0.45],
  close: [0.15, 0.35],
  sourcedPerDay: [24, 40],
  thinSourcedPerDay: [6, 10],
  intentShare: [0.15, 0.35],
} as const;

/** The stage each arena's genes mainly move, plus a smaller spillover. */
const ARENA_STAGES: Record<ArenaKey, { primary: Stage; spill?: Stage }> = {
  prospecting: { primary: "rep", spill: "acc" },
  intent: { primary: "rep", spill: "acc" },
  qualification: { primary: "rep", spill: "acc" },
  outreach_first_touch: { primary: "acc", spill: "rep" },
  outreach_followup: { primary: "rep" },
  conversation: { primary: "book" },
  closing: { primary: "close" },
};

export const effectKey = (arena: ArenaKey, gene: string, value: string) => `${arena}|${gene}=${value}`;

function normal(r: () => number): number {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const uni = (r: () => number, [lo, hi]: readonly [number, number]) => lo + (hi - lo) * r();

export function generateWorld(input: {
  seed: number;
  family: Family;
  accounts: number;
  horizonDays: number;
  arenas: ArenaKey[];
}): World {
  const r = mulberry32(input.seed);
  const fam = input.family;
  const thin = fam === "thin_data";
  const accounts: SimAccount[] = Array.from({ length: input.accounts }, (_, i) => ({
    id: `acct${i + 1}`,
    sourcedPerDay: Math.round(uni(r, thin ? WORLD_RANGES.thinSourcedPerDay : WORLD_RANGES.sourcedPerDay)),
    intentShare: uni(r, WORLD_RANGES.intentShare),
    segment: (i % 2) as 0 | 1,
    base: {
      qual: uni(r, WORLD_RANGES.qual),
      acc: uni(r, WORLD_RANGES.acc),
      rep: uni(r, WORLD_RANGES.rep),
      neg: uni(r, WORLD_RANGES.neg),
      book: uni(r, WORLD_RANGES.book),
      close: uni(r, WORLD_RANGES.close),
    },
  }));

  const effects = new Map<string, Effect>();
  const winnerMag: [number, number] | null =
    fam === "no_winner" ? null : fam === "small_effect" ? [0.08, 0.15] : [0.35, 0.6];

  for (const arena of input.arenas) {
    const { primary, spill } = ARENA_STAGES[arena];
    for (const [gene, spec] of Object.entries(ARENAS[arena].genes)) {
      const alternatives = spec.values.filter((v) => v !== spec.default);
      // One planted winner per gene in winner families (some genes get none: not every lever matters).
      const plantWinner = winnerMag !== null && fam !== "realistic_mix" && r() < 0.6;
      const winner = plantWinner ? alternatives[Math.floor(r() * alternatives.length)] : undefined;
      for (const v of alternatives) {
        const e: Effect = {};
        if (fam === "no_winner") {
          // exactly zero everywhere: any promotion is false
        } else if (fam === "realistic_mix") {
          e[primary] = normal(r) * 0.15;
          if (spill) e[spill] = normal(r) * 0.05;
          e.neg = normal(r) * 0.1;
        } else {
          const noise = fam === "small_effect" ? 0.03 : 0.05;
          e[primary] = v === winner ? uni(r, winnerMag!) : normal(r) * noise;
          if (spill) e[spill] = v === winner ? uni(r, [0.02, 0.08]) : 0;
        }
        // Qualification threshold is a real trade-off: stricter scores pass fewer people but better ones.
        if (arena === "qualification" && gene === "minScore") {
          const step = spec.values.indexOf(v);
          e.qual = -0.35 * step;
          if (fam !== "no_winner") e.rep = (e.rep ?? 0) + step * uni(r, [0.02, 0.18]);
        }
        effects.set(effectKey(arena, gene, v), e);
      }
    }
  }

  // Guardrail trap: a first-touch and a follow-up value that lift success but sharply raise opt-outs.
  if (fam === "guardrail_trap") {
    const trap = (arena: ArenaKey, gene: string, value: string, stage: Stage) => {
      if (!input.arenas.includes(arena)) return;
      effects.set(effectKey(arena, gene, value), { [stage]: 0.55, neg: 1.6 });
    };
    trap("outreach_first_touch", "messageShape", "gift", "acc");
    trap("outreach_followup", "touches", "3", "rep");
  }

  // Segment flip: odd-segment accounts experience every planted effect reversed.
  const accountDev = new Map<string, Map<string, Effect>>();
  for (const a of accounts) {
    const dev = new Map<string, Effect>();
    for (const [k, e] of effects) {
      const d: Effect = {};
      for (const s of Object.keys(e) as Stage[]) {
        if (s === "qual") continue;
        if (fam === "segment_flip" && a.segment === 1 && s !== "neg") d[s] = -2 * (e[s] ?? 0);
        else if (fam === "realistic_mix") d[s] = normal(r) * 0.08;
      }
      if (Object.keys(d).length) dev.set(k, d);
    }
    accountDev.set(a.id, dev);
  }

  let driftEffects: Map<string, Effect> | null = null;
  if (fam === "drift") {
    driftEffects = new Map();
    for (const [k, e] of effects) {
      const d: Effect = { ...e };
      for (const s of ["acc", "rep", "book", "close"] as Stage[]) if (d[s] !== undefined) d[s] = -d[s]!;
      driftEffects.set(k, d);
    }
  }

  return {
    seed: input.seed,
    family: fam,
    horizonDays: input.horizonDays,
    driftDay: fam === "drift" ? Math.floor(input.horizonDays / 2) : null,
    accounts,
    effects,
    driftEffects,
    accountDev,
  };
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const STAGES: Stage[] = ["qual", "acc", "rep", "neg", "book", "close"];
const sigOf = new WeakMap<Genome, string>();
function genomeKey(g: Genome): string {
  let k = sigOf.get(g);
  if (k === undefined) {
    k = Object.keys(g)
      .sort()
      .map((x) => `${x}=${g[x]}`)
      .join(";");
    sigOf.set(g, k);
  }
  return k;
}
const deltaCache = new WeakMap<World, Map<string, number[]>>();

/** Summed logit deltas of one arena genome for one account in one epoch (cached). */
function arenaDelta(w: World, account: SimAccount, arena: ArenaKey, g: Genome, epoch: number): number[] {
  let cache = deltaCache.get(w);
  if (!cache) {
    cache = new Map();
    deltaCache.set(w, cache);
  }
  const key = `${account.id}|${epoch}|${arena}|${genomeKey(g)}`;
  let d = cache.get(key);
  if (d) return d;
  const eff = epoch === 1 && w.driftEffects ? w.driftEffects : w.effects;
  const dev = w.accountDev.get(account.id)!;
  d = [0, 0, 0, 0, 0, 0];
  for (const [gene, value] of Object.entries(g)) {
    const k = effectKey(arena, gene, value);
    const e = eff.get(k);
    const dv = dev.get(k);
    for (let i = 0; i < 6; i++) d[i]! += (e?.[STAGES[i]!] ?? 0) + (dv?.[STAGES[i]!] ?? 0);
  }
  cache.set(key, d);
  return d;
}

/** True stage probabilities for one account under a set of arena genomes on a given day. */
export function stageProbs(
  w: World,
  account: SimAccount,
  genomes: Partial<Record<ArenaKey, Genome>>,
  day: number
): Record<Stage, number> {
  const epoch = w.driftDay !== null && day >= w.driftDay ? 1 : 0;
  const L = [
    logit(account.base.qual),
    logit(account.base.acc),
    logit(account.base.rep),
    logit(account.base.neg),
    logit(account.base.book),
    logit(account.base.close),
  ];
  for (const arena in genomes) {
    const g = genomes[arena as ArenaKey];
    if (!g) continue;
    const d = arenaDelta(w, account, arena as ArenaKey, g, epoch);
    for (let i = 0; i < 6; i++) L[i]! += d[i]!;
  }
  const p = {
    qual: sigmoid(L[0]!),
    acc: sigmoid(L[1]!),
    rep: sigmoid(L[2]!),
    neg: sigmoid(L[3]!),
    book: sigmoid(L[4]!),
    close: sigmoid(L[5]!),
  };
  // interested + negative are mutually exclusive outcomes of one reply draw
  if (p.rep + p.neg > 0.95) p.neg = Math.max(0, 0.95 - p.rep);
  return p;
}

/** The arena's own metric under true probabilities (what a perfect evaluator would measure). */
export function trueArenaMetric(arena: ArenaKey, p: Record<Stage, number>): number {
  switch (arena) {
    case "prospecting":
    case "intent":
    case "qualification":
      return p.qual * p.acc * p.rep;
    case "outreach_first_touch":
      return p.acc;
    case "outreach_followup":
      return p.rep;
    case "conversation":
      return p.book;
    case "closing":
      return p.close;
  }
}

/** Business objective per sourced unit: expected meetings booked. */
export const meetingsPerSourced = (p: Record<Stage, number>) => p.qual * p.acc * p.rep * p.book;
