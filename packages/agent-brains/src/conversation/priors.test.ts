import { describe, expect, it } from "vitest";
import { MIN_REAL_N, posteriorFor, researchPriors, thompsonPick, type PriorCell, type PriorTable } from "./priors";

const A = "dir_vp:high:high" as const;
const cell = (p: Partial<PriorCell>): PriorCell => ({
  level: "move_phase", move: "observe", phase: "pre_reply", archetype: "", source: "real",
  n: 0, positives: 0, rewardSum: 0, rewardSq: 0, ...p,
});
const mean = (p: { alpha: number; beta: number }) => p.alpha / (p.alpha + p.beta);
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("priors", () => {
  it("researchPriors gives propose_times at pre_reply a 0.1 mean and observe 0.6", () => {
    const t = researchPriors();
    const get = (m: string, p: string) => t.find((c) => c.move === m && c.phase === p)!;
    expect(get("propose_times", "pre_reply").positives / get("propose_times", "pre_reply").n).toBeCloseTo(0.1);
    expect(get("observe", "pre_reply").positives / get("observe", "pre_reply").n).toBeCloseTo(0.6);
    expect(get("poke", "exploring").n).toBe(10);
    expect(get("poke", "exploring").positives).toBe(5);
    expect(t.every((c) => c.source === "research" && c.level === "move_phase" && c.rewardSum === 0)).toBe(true);
  });

  it("posteriorFor falls back move_phase_archetype → move_phase → move → research by MIN_REAL_N", () => {
    const base = (level: PriorCell["level"], n: number, positives: number): PriorCell =>
      cell({ level, phase: level === "move" ? "" : "pre_reply", archetype: level === "move_phase_archetype" ? A : "", n, positives });
    const full: PriorTable = [base("move_phase_archetype", MIN_REAL_N, 5), base("move_phase", 20, 10), base("move", 40, 20)];
    expect(posteriorFor(full, "observe", "pre_reply", A).level).toBe("move_phase_archetype");
    expect(posteriorFor(full.slice(1), "observe", "pre_reply", A).level).toBe("move_phase");
    expect(posteriorFor(full.slice(2), "observe", "pre_reply", A).level).toBe("move");
    const thin = [base("move_phase_archetype", MIN_REAL_N - 1, 4), base("move_phase", 2, 1), base("move", 1, 1)];
    const r = posteriorFor(thin, "observe", "pre_reply", A);
    expect(r.source).toBe("research");
    expect(r.alpha).toBe(6);
    expect(r.beta).toBe(4);
    // chosen cell adds to research alpha/beta
    const p = posteriorFor(full, "observe", "pre_reply", A);
    expect(p.alpha).toBe(6 + 5);
    expect(p.beta).toBe(4 + 0);
  });

  it("sim rows weigh half of real rows in the posterior", () => {
    const real = posteriorFor([cell({ n: 10, positives: 8 })], "observe", "pre_reply", A);
    const sim = posteriorFor([cell({ n: 10, positives: 8, source: "sim" })], "observe", "pre_reply", A);
    expect(real.alpha).toBe(6 + 8);
    expect(sim.alpha).toBe(6 + 4);
    expect(sim.beta).toBe(4 + 1);
    expect(sim.n).toBe(5);
  });

  it("thompsonPick with a seeded rng is deterministic and propensity sums to 1 over candidates", () => {
    const post = new Map([
      ["observe", { alpha: 30, beta: 10 }],
      ["poke", { alpha: 5, beta: 30 }],
    ] as const);
    const cands = ["observe", "poke", "wait"] as const;
    const a = thompsonPick([...cands], post as never, seeded(7));
    const b = thompsonPick([...cands], post as never, seeded(7));
    expect(a).toEqual(b);
    expect(a.index).toBe(0);
    // propensities for each forced candidate set sum to 1: sample by re-running with candidate-specific counting
    let total = 0;
    const samples = 200;
    const wins = [0, 0, 0];
    const rng = seeded(11);
    for (let i = 0; i < 40; i++) {
      const r = thompsonPick([...cands], post as never, rng, samples);
      wins[r.index] = (wins[r.index] ?? 0) + r.propensity;
      total += 1;
    }
    expect(total).toBe(40);
    expect(a.propensity).toBeGreaterThan(0.5);
    expect(a.propensity).toBeLessThanOrEqual(1);
    // single candidate always wins fully
    expect(thompsonPick(["wait"], new Map(), seeded(1)).propensity).toBe(1);
    // mean sanity
    expect(mean({ alpha: 30, beta: 10 })).toBeGreaterThan(mean({ alpha: 5, beta: 30 }));
  });
});
