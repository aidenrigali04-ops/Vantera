import { describe, expect, it } from "vitest";
import {
  ALPHA_EARN_ON_CONCLUSION,
  ALPHA_MIN_SPEND,
  ALPHA_WEALTH_CAP,
  ALPHA_WEALTH_START,
  nextAlphaSpend,
  wealthAfterConclusion,
  wealthAfterLaunch,
} from "./alpha";

describe("alpha-investing constants", () => {
  it("match the values calibration.test.ts's CHAINED FAMILY test measured against", () => {
    expect(ALPHA_WEALTH_START).toBe(0.05);
    expect(ALPHA_WEALTH_CAP).toBe(0.1);
    expect(ALPHA_EARN_ON_CONCLUSION).toBe(0.02);
    expect(ALPHA_MIN_SPEND).toBe(0.005);
  });
});

describe("nextAlphaSpend", () => {
  it("spends half the wealth at the starting balance", () => {
    // 0.05 / 2 = 0.025, inside [0.005, 0.05] — no clamping needed.
    expect(nextAlphaSpend(0.05)).toBeCloseTo(0.025, 10);
  });

  it("ceilings the spend at 0.05 once wealth is large enough that half would exceed it", () => {
    // 0.10 / 2 = 0.05 exactly — right at the ceiling.
    expect(nextAlphaSpend(0.1)).toBeCloseTo(0.05, 10);
  });

  it("floors the spend at ALPHA_MIN_SPEND when half the wealth would dip below it", () => {
    // 0.006 / 2 = 0.003, below the 0.005 floor — clamps up to 0.005.
    expect(nextAlphaSpend(0.006)).toBeCloseTo(0.005, 10);
  });

  it("still spends exactly at the pause floor (boundary is inclusive)", () => {
    // wealth === ALPHA_MIN_SPEND is NOT "< ALPHA_MIN_SPEND" — one more spend is allowed.
    expect(nextAlphaSpend(0.005)).toBeCloseTo(0.005, 10);
  });

  it("returns null just below the pause floor — the chain must pause", () => {
    expect(nextAlphaSpend(0.004)).toBeNull();
  });

  it("returns null at zero wealth", () => {
    expect(nextAlphaSpend(0)).toBeNull();
  });

  it("never returns a spend above 0.05 even at the wealth cap", () => {
    const spend = nextAlphaSpend(ALPHA_WEALTH_CAP);
    expect(spend).not.toBeNull();
    expect(spend!).toBeLessThanOrEqual(0.05);
  });
});

describe("wealthAfterLaunch", () => {
  it("debits the spend from wealth", () => {
    expect(wealthAfterLaunch(0.05, 0.025)).toBeCloseTo(0.025, 10);
  });

  it("composes with nextAlphaSpend's output without going negative", () => {
    const wealth = 0.006;
    const spend = nextAlphaSpend(wealth)!;
    expect(wealthAfterLaunch(wealth, spend)).toBeGreaterThanOrEqual(0);
  });
});

describe("wealthAfterConclusion", () => {
  it("earns ALPHA_EARN_ON_CONCLUSION back", () => {
    expect(wealthAfterConclusion(0.025)).toBeCloseTo(0.045, 10);
  });

  it("caps at ALPHA_WEALTH_CAP instead of overshooting", () => {
    // 0.09 + 0.02 = 0.11, above the 0.10 cap.
    expect(wealthAfterConclusion(0.09)).toBeCloseTo(0.1, 10);
  });

  it("is a no-op past the cap (idempotent at the ceiling)", () => {
    expect(wealthAfterConclusion(ALPHA_WEALTH_CAP)).toBeCloseTo(ALPHA_WEALTH_CAP, 10);
  });

  it("starting-wealth-then-earn lands where pg-store's fresh-row credit expects (0.07)", () => {
    // The value pg-store.ts's creditAlphaWealth uses for a never-before-seen playbook row.
    expect(wealthAfterConclusion(ALPHA_WEALTH_START)).toBeCloseTo(0.07, 10);
  });
});
