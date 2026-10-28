import { MOVES, type Move } from "./moves";
import type { Archetype, Phase } from "./state";

export type Level = "move" | "move_phase" | "move_phase_archetype";
export type PriorSource = "research" | "sim" | "real";
export type PriorCell = {
  level: Level;
  move: Move;
  phase: Phase | "";
  archetype: Archetype | "";
  source: PriorSource;
  n: number;
  positives: number;
  rewardSum: number;
  rewardSq: number;
};
export type PriorTable = PriorCell[];

export const MIN_REAL_N = 5;
const PHASES: Phase[] = ["pre_reply", "engaged", "exploring", "asked", "after_no"];
/** Weight of a simulated observation relative to a real one. */
const SIM_WEIGHT = 0.5;

/** [alpha, n] per (phase, move); everything unlisted is 5/10. */
const RESEARCH: Record<Phase, Partial<Record<Move, [number, number]>>> = {
  pre_reply: { observe: [6, 10], ask_discovery: [6, 10], soft_ask: [3, 10], propose_times: [1, 10], offer_value: [4, 10] },
  engaged: { answer: [7, 10], acknowledge: [5, 10], ask_discovery: [6, 10], soft_ask: [3, 10] },
  exploring: { observe: [6, 10], ask_discovery: [5, 10], offer_value: [5, 10], soft_ask: [5, 10], propose_times: [2, 10] },
  asked: { wait: [6, 10], offer_value: [5, 10], breakup: [4, 10] },
  after_no: { graceful_exit: [8, 10], poke: [3, 10], wait: [7, 10] },
};

export function researchPriors(): PriorTable {
  const out: PriorTable = [];
  for (const phase of PHASES) {
    for (const move of MOVES) {
      const [alpha, n] = RESEARCH[phase][move] ?? [5, 10];
      out.push({ level: "move_phase", move, phase, archetype: "", source: "research", n, positives: alpha, rewardSum: 0, rewardSq: 0 });
    }
  }
  return out;
}

const RESEARCH_TABLE = researchPriors();

function firstMatch(table: PriorTable, level: Level, source: PriorSource, move: Move, phase: Phase, archetype: Archetype) {
  return table.find(
    (c) =>
      c.level === level &&
      c.source === source &&
      c.move === move &&
      (level === "move" || c.phase === phase) &&
      (level !== "move_phase_archetype" || c.archetype === archetype),
  );
}

export function posteriorFor(
  table: PriorTable,
  move: Move,
  phase: Phase,
  archetype: Archetype,
): { alpha: number; beta: number; n: number; level: Level; source: PriorSource } {
  const r = RESEARCH_TABLE.find((c) => c.move === move && c.phase === phase);
  const rAlpha = r ? r.positives : 5;
  const rBeta = r ? r.n - r.positives : 5;
  for (const level of ["move_phase_archetype", "move_phase", "move"] as const) {
    const real = firstMatch(table, level, "real", move, phase, archetype);
    const sim = firstMatch(table, level, "sim", move, phase, archetype);
    const n = (real?.n ?? 0) + SIM_WEIGHT * (sim?.n ?? 0);
    if (n < MIN_REAL_N) continue;
    const positives = (real?.positives ?? 0) + SIM_WEIGHT * (sim?.positives ?? 0);
    return { alpha: rAlpha + positives, beta: rBeta + (n - positives), n, level, source: real ? "real" : "sim" };
  }
  return { alpha: rAlpha, beta: rBeta, n: 0, level: "move_phase", source: "research" };
}

function normal(rng: () => number): number {
  const u = Math.max(rng(), Number.MIN_VALUE);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Marsaglia–Tsang gamma(shape, 1) sampler on an injected uniform rng. */
function gamma(shape: number, rng: () => number): number {
  if (shape < 1) return gamma(shape + 1, rng) * Math.pow(Math.max(rng(), Number.MIN_VALUE), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(Math.max(u, Number.MIN_VALUE)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function beta(a: number, b: number, rng: () => number): number {
  const x = gamma(a, rng);
  const y = gamma(b, rng);
  return x + y === 0 ? 0.5 : x / (x + y);
}

export function thompsonPick(
  candidates: Move[],
  posteriors: Map<Move, { alpha: number; beta: number }>,
  rng: () => number,
  samples = 200,
): { index: number; propensity: number } {
  if (candidates.length === 0) return { index: -1, propensity: 0 };
  const wins = new Array<number>(candidates.length).fill(0);
  for (let s = 0; s < samples; s++) {
    let best = 0;
    let bestV = -1;
    candidates.forEach((m, i) => {
      const p = posteriors.get(m) ?? { alpha: 1, beta: 1 };
      const v = beta(p.alpha, p.beta, rng);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    wins[best] = (wins[best] ?? 0) + 1;
  }
  let index = 0;
  for (let i = 1; i < wins.length; i++) if (wins[i]! > wins[index]!) index = i;
  return { index, propensity: wins[index]! / samples };
}
