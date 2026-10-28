import { describe, expect, it } from "vitest";
import { MIN_REAL_N, beta, posteriorFor, researchPriors, thompsonPick, winShares, type PriorCell, type PriorTable } from "./priors";

const A = "dir_vp:high:high" as const;
const cell = (p: Partial<PriorCell>): PriorCell => ({
  level: "move_phase", move: "observe", phase: "pre_reply", archetype: "", source: "real",
  count: p.n ?? 0, n: 0, positives: 0, rewardSum: 0, rewardSq: 0, ...p,
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

  it("IPW-heavy single observation does not satisfy MIN_REAL_N; posterior is self-normalised", () => {
    const one = cell({ count: 1, n: 10, positives: 10 });
    expect(posteriorFor([one], "observe", "pre_reply", A).source).toBe("research");
    const five = cell({ count: 5, n: 20, positives: 10 });
    const p = posteriorFor([five], "observe", "pre_reply", A);
    expect(p.n).toBe(5);
    expect(p.alpha).toBeCloseTo(6 + 10 * (5 / 20));
    expect(p.beta).toBeCloseTo(4 + 10 * (5 / 20));
  });

  it("beta sampler mean matches a/(a+b), including shape < 1", () => {
    for (const [a, b] of [[0.5, 0.5], [0.3, 2], [5, 30], [30, 10]] as const) {
      const rng = seeded(42);
      let sum = 0;
      for (let i = 0; i < 2000; i++) sum += beta(a, b, rng);
      expect(Math.abs(sum / 2000 - a / (a + b))).toBeLessThan(0.05);
    }
  });

  it("beta guards non-finite or non-positive shapes", () => {
    const v = beta(NaN, -3, seeded(1));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });

  it("thompsonPick is stochastic across seeds when posteriors overlap, deterministic per seed", () => {
    const post = new Map([
      ["observe", { alpha: 6, beta: 4 }],
      ["poke", { alpha: 5, beta: 5 }],
    ] as const);
    const picks = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) picks.add(thompsonPick(["observe", "poke"], post as never, seeded(seed)).index);
    expect(picks.size).toBe(2);
    expect(thompsonPick(["observe", "poke"], post as never, seeded(9))).toEqual(thompsonPick(["observe", "poke"], post as never, seeded(9)));
  });

  it("propensity of a dominant candidate is >= 0.95 and win shares over 3 candidates sum to 1", () => {
    const post = new Map([
      ["observe", { alpha: 30, beta: 2 }],
      ["poke", { alpha: 2, beta: 30 }],
      ["wait", { alpha: 5, beta: 5 }],
    ] as const);
    const r = thompsonPick(["observe", "poke", "wait"], post as never, seeded(3));
    expect(r.index).toBe(0);
    expect(r.propensity).toBeGreaterThanOrEqual(0.95);
    const shares = winShares(["observe", "poke", "wait"], post as never, seeded(4));
    expect(Math.abs(shares.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(0.01);
    expect(thompsonPick(["wait"], new Map(), seeded(1)).propensity).toBe(1);
    expect(mean({ alpha: 30, beta: 10 })).toBeGreaterThan(0.5);
  });
});
