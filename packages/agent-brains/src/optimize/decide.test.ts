import { describe, expect, it } from "vitest";
import { decideExperiment, type VariantOutcome } from "./decide";

const O = (denominator: number, successes: number, negatives = 0): VariantOutcome => ({
  denominator,
  successes,
  negatives,
});

describe("decideExperiment", () => {
  it("keeps running until both arms reach the minimum sample", () => {
    expect(decideExperiment(O(10, 3), O(10, 5)).decision).toBe("keep_running");
    expect(decideExperiment(O(100, 20), O(10, 5)).decision).toBe("keep_running"); // challenger too small
  });

  it("adopts a confident, meaningful winner", () => {
    expect(decideExperiment(O(100, 20), O(100, 40)).decision).toBe("adopt_challenger");
  });

  it("does not adopt on a tiny, non-confident edge", () => {
    expect(decideExperiment(O(100, 20), O(100, 22)).decision).toBe("keep_running");
  });

  it("discards when the champion is confidently better", () => {
    expect(decideExperiment(O(100, 40), O(100, 15)).decision).toBe("discard_challenger");
  });

  it("HALTS on materially more negative replies even when replies are higher (do-no-harm)", () => {
    // challenger has MORE interested replies (40% vs 20%) but far more negatives (15% vs 3%)
    expect(decideExperiment(O(100, 20, 3), O(100, 40, 15)).decision).toBe("halt");
  });

  it("halts on an unacceptable absolute negative rate", () => {
    expect(decideExperiment(O(50, 10, 10), O(50, 15, 18)).decision).toBe("halt"); // 36% > 30% ceiling
  });

  it("does not trip the breaker on a tiny challenger sample", () => {
    expect(decideExperiment(O(100, 20, 3), O(10, 2, 3)).decision).toBe("keep_running");
  });

  it("simulation: a genuinely better challenger progresses to adopt as data accrues", () => {
    // true rates: champion 20%, challenger 35%, both ~2% negatives
    const steps = [10, 30, 60, 120];
    const decisions = steps.map(
      (n) =>
        decideExperiment(
          O(n, Math.round(n * 0.2), Math.round(n * 0.02)),
          O(n, Math.round(n * 0.35), Math.round(n * 0.02))
        ).decision
    );
    expect(decisions[0]).toBe("keep_running"); // n=10, below sample
    expect(decisions[decisions.length - 1]).toBe("adopt_challenger");
  });

  it("simulation: an equal challenger never returns a false-positive adopt", () => {
    for (const n of [30, 100, 300, 1000]) {
      const d = decideExperiment(O(n, Math.round(n * 0.2)), O(n, Math.round(n * 0.2))).decision;
      expect(d).not.toBe("adopt_challenger");
    }
  });

  it("simulation: a slightly-worse challenger is never adopted and eventually discarded", () => {
    // champion 25%, challenger 18%
    const big = decideExperiment(O(400, 100), O(400, 72)).decision;
    expect(big).toBe("discard_challenger");
  });
});
