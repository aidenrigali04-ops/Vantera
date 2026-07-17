import { describe, expect, it } from "vitest";
import {
  clampDecideV2Options,
  DECIDE_V2_DEFAULTS,
  decideExperimentV2,
  type DecideV2Options,
} from "./decide-v2";
import type { VariantOutcome } from "./decide";
import { mulberry32 } from "./sim/harness";

const O = (denominator: number, successes: number, negatives = 0): VariantOutcome => ({
  denominator,
  successes,
  negatives,
});

describe("decideExperimentV2", () => {
  it("the circuit breaker fires FIRST, even when e is rigged sky-high", () => {
    // champ 10/100 (3% negatives) vs chal 60/100 (40% negatives, >= the 30% hard ceiling).
    // e for this pair is astronomically large (>1000), but the breaker must win regardless.
    const champion = O(100, 10, 3);
    const challenger = O(100, 60, 40);
    const verdict = decideExperimentV2(champion, challenger);
    expect(verdict.decision).toBe("halt");
    expect(verdict.reason).toMatch(/negative/);
  });

  it("keeps running when e is below threshold at a tiny n", () => {
    // champ 3/10 vs chal 4/10 — challenger denominator (10) is below breakerMinSample (15), so
    // the breaker never evaluates; e (~0.53) is far below the default threshold (1/.05 = 20).
    const verdict = decideExperimentV2(O(10, 3), O(10, 4));
    expect(verdict.decision).toBe("keep_running");
    expect(verdict.reason).toMatch(/evidence/);
  });

  it("keeps running when e is below threshold at a huge n (no minimum-n floor rescues it)", () => {
    // champ 200/1000 vs chal 210/1000 — a real but tiny (1pp) gap; e (~0.05) never approaches 20
    // no matter how large n gets, because the true difference is negligible.
    const verdict = decideExperimentV2(O(1000, 200), O(1000, 210));
    expect(verdict.decision).toBe("keep_running");
    expect(verdict.reason).toMatch(/evidence/);
  });

  it("adopts a confident, practically-meaningful winner", () => {
    // champ 9/60 (15%) vs chal 24/60 (40%): e≈22.3 (clears the default threshold of 20),
    // medianLiftPp≈24.4 (clears minEffectPp=3), expectedAdoptionLossPp≈0.004 (well under 0.5).
    // Measured directly against eValueTwoProportions/posteriorSummary before picking these counts.
    const verdict = decideExperimentV2(O(60, 9), O(60, 24), { rng: mulberry32(7) });
    expect(verdict.decision).toBe("adopt_challenger");
    expect(verdict.reason).toMatch(/24\.\d/); // carries the lift
  });

  it("discards a confidently-worse challenger (mirrored counts of the adopt case)", () => {
    // champ 24/60 (40%) vs chal 9/60 (15%): same |e|≈22.3, medianLiftPp≈-24.1 (<= -minEffectPp).
    const verdict = decideExperimentV2(O(60, 24), O(60, 9), { rng: mulberry32(7) });
    expect(verdict.decision).toBe("discard_challenger");
  });

  it("the loss cap blocks adoption despite a qualifying e-value and a large median lift", () => {
    // champ 0/3 vs chal 5/5: e=21.0 (clears the default threshold of 20), medianLiftPp≈68.8
    // (clears minEffectPp=3 by a wide margin) — but expectedAdoptionLossPp≈0.021 at this seed,
    // which exceeds a deliberately tight maxAdoptionLossPp of 0.01. Measured across 16 seeds
    // (range ~0.02-0.07) before picking seed 7 and the 0.01 cap for a robust margin.
    const options: DecideV2Options = { maxAdoptionLossPp: 0.01, rng: mulberry32(7) };
    const verdict = decideExperimentV2(O(3, 0), O(5, 5), options);
    expect(verdict.decision).toBe("keep_running");
    expect(verdict.reason).toMatch(/not a practical winner/);
  });

  it("is deterministic given the same injected rng", () => {
    const options: DecideV2Options = { rng: mulberry32(42) };
    const a = decideExperimentV2(O(60, 9), O(60, 24), options);
    const b = decideExperimentV2(O(60, 9), O(60, 24), { rng: mulberry32(42) });
    expect(a).toEqual(b);
  });
});

describe("DECIDE_V2_DEFAULTS", () => {
  it("matches the sim-tuned starting point", () => {
    expect(DECIDE_V2_DEFAULTS.alpha).toBe(0.05);
    expect(DECIDE_V2_DEFAULTS.minEffectPp).toBe(3);
    expect(DECIDE_V2_DEFAULTS.maxAdoptionLossPp).toBe(0.5);
    // breaker constants carried over from the legacy gate, unchanged.
    expect(DECIDE_V2_DEFAULTS.breakerMinSample).toBe(15);
    expect(DECIDE_V2_DEFAULTS.harmMarginPp).toBe(8);
    expect(DECIDE_V2_DEFAULTS.hardNegCeilingPct).toBe(30);
  });
});

describe("clampDecideV2Options", () => {
  it("passes through values already inside bounds", () => {
    const o = clampDecideV2Options({ alpha: 0.02, minEffectPp: 5, maxAdoptionLossPp: 1 });
    expect(o.alpha).toBe(0.02);
    expect(o.minEffectPp).toBe(5);
    expect(o.maxAdoptionLossPp).toBe(1);
  });

  it("fills in missing fields from DECIDE_V2_DEFAULTS", () => {
    const o = clampDecideV2Options({});
    expect(o).toEqual(DECIDE_V2_DEFAULTS);
  });

  it("clamps every field on the low side (never throws)", () => {
    const o = clampDecideV2Options({
      alpha: -1,
      minEffectPp: 0,
      maxAdoptionLossPp: 0,
      breakerMinSample: 0,
      harmMarginPp: 0,
      hardNegCeilingPct: 0,
    });
    expect(o.alpha).toBe(0.002);
    expect(o.minEffectPp).toBe(1);
    expect(o.maxAdoptionLossPp).toBe(0.1);
    expect(o.breakerMinSample).toBe(10);
    expect(o.harmMarginPp).toBe(4);
    expect(o.hardNegCeilingPct).toBe(15);
  });

  it("clamps every field on the high side (never throws)", () => {
    const o = clampDecideV2Options({
      alpha: 1,
      minEffectPp: 999,
      maxAdoptionLossPp: 999,
      breakerMinSample: 5, // below the 10 floor — clamps UP, not down
      harmMarginPp: 999,
      hardNegCeilingPct: 999,
    });
    expect(o.alpha).toBe(0.05);
    expect(o.minEffectPp).toBe(10);
    expect(o.maxAdoptionLossPp).toBe(2);
    expect(o.breakerMinSample).toBe(10);
    expect(o.harmMarginPp).toBe(20);
    expect(o.hardNegCeilingPct).toBe(50);
  });

  it("never throws on garbage input (NaN, negative, non-finite)", () => {
    expect(() =>
      clampDecideV2Options({
        alpha: Number.NaN,
        minEffectPp: -Infinity,
        maxAdoptionLossPp: Infinity,
      })
    ).not.toThrow();
    const o = clampDecideV2Options({ alpha: Number.NaN, minEffectPp: -Infinity, maxAdoptionLossPp: Infinity });
    expect(o.alpha).toBe(DECIDE_V2_DEFAULTS.alpha);
    expect(o.minEffectPp).toBe(1);
    expect(o.maxAdoptionLossPp).toBe(2);
  });
});
