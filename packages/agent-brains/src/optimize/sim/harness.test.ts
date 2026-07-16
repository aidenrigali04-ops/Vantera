import { describe, expect, it } from "vitest";
import { runMonteCarlo, simulateDecisionPath, mulberry32 } from "./harness";

describe("optimize sim harness", () => {
  it("is deterministic under a fixed seed", () => {
    const cfg = { championRate: 0.15, challengerRate: 0.15, negativeRate: 0.05,
      perDayPerArm: 8, horizonDays: 90 };
    expect(runMonteCarlo(200, 42, cfg)).toEqual(runMonteCarlo(200, 42, cfg));
  });

  it("adopts a genuinely large lift most of the time (power sanity)", () => {
    const r = runMonteCarlo(500, 7, { championRate: 0.10, challengerRate: 0.25,
      negativeRate: 0.05, perDayPerArm: 8, horizonDays: 90 });
    expect(r.adoptRate).toBeGreaterThan(0.6);
  });

  it("CHARACTERIZATION: current core's false-adoption rate under the null, daily peeking", () => {
    // A/A truth (championRate === challengerRate === 0.15, negativeRate 0.05 both arms,
    // perDayPerArm 8, horizonDays 90, n=2000 runs, seed 1234): any adopt is false. Measured
    // adoptRate = 0.306 (30.6%) — this documents the CURRENT gate's miscalibration from daily
    // peeking, and is the evidence behind GATE 0's suggest-only flip. GATE 1 (Phase 2) requires
    // the REPLACEMENT core to bring this down to ≤ 0.05.
    const r = runMonteCarlo(2000, 1234, { championRate: 0.15, challengerRate: 0.15,
      negativeRate: 0.05, perDayPerArm: 8, horizonDays: 90 });
    expect(r.adoptRate).toBeCloseTo(0.306, 3);
  });
});
