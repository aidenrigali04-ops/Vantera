import { describe, expect, it } from "vitest";
import { ARENAS, type ArenaKey } from "../hive/arenas";
import { WORLD_RANGES, generateWorld } from "../hive/sim/world";
import { checkHoldout, fitRanges, type FunnelCohort } from "./calibrate";

const EMPTY: FunnelCohort = {
  sourced: 0,
  qualified: 0,
  invited: 0,
  accepted: 0,
  interested: 0,
  negative: 0,
  booked: 0,
  closed: 0,
};

/** Stage rates 0.50 × 0.30 × 0.20 × 0.40. Every denominator clears the sample gate of 20. */
function cohort(scale = 1): FunnelCohort {
  const s = scale;
  return {
    sourced: 5000 * s,
    qualified: 2500 * s,
    invited: 2000 * s,
    accepted: 600 * s,
    interested: 120 * s,
    negative: 30 * s,
    booked: 48 * s,
    closed: 12 * s,
  };
}

describe("fitRanges", () => {
  it("keeps the assumed ranges when the cohort is empty", () => {
    const fit = fitRanges(EMPTY);
    expect(fit.fitted).toBe(false);
    expect(fit.ranges).toBe(WORLD_RANGES);
    expect(fit.short.map((s) => s.stage)).toEqual(["qual", "acc", "rep", "neg", "book", "close"]);
  });

  it("replaces stage bands with the training interval and leaves volume alone", () => {
    const fit = fitRanges(cohort());
    expect(fit.fitted).toBe(true);
    expect(fit.ranges.sourcedPerDay).toEqual(WORLD_RANGES.sourcedPerDay);
    expect(fit.ranges.intentShare).toEqual(WORLD_RANGES.intentShare);
    expect(fit.rates.acc.p).toBeCloseTo(0.3, 5);
    expect(fit.ranges.acc[0]).toBeLessThan(fit.rates.acc.p);
    expect(fit.ranges.acc[1]).toBeGreaterThan(fit.rates.acc.p);
  });

  it("draws account base rates inside a fitted band", () => {
    const fit = fitRanges(cohort());
    const world = generateWorld({
      seed: 11,
      family: "realistic_mix",
      accounts: 8,
      horizonDays: 30,
      arenas: Object.keys(ARENAS) as ArenaKey[],
      ranges: fit.ranges,
    });
    for (const account of world.accounts) {
      expect(account.base.acc).toBeGreaterThanOrEqual(fit.ranges.acc[0]);
      expect(account.base.acc).toBeLessThanOrEqual(fit.ranges.acc[1]);
    }
  });
});

describe("checkHoldout", () => {
  it("is inconclusive on an empty training window", () => {
    const report = checkHoldout(EMPTY, cohort());
    expect(report.status).toBe("inconclusive");
    expect(report.fitted).toBe(false);
  });

  it("accepts a holdout drawn from the same rates", () => {
    const report = checkHoldout(cohort(2), cohort(1));
    expect(report.status).toBe("inside");
    expect(report.predicted).not.toBeNull();
  });

  it("rejects a holdout whose meeting rate is far from the training world", () => {
    const train = cohort();
    const holdout: FunnelCohort = { ...cohort(), booked: 400 };
    const report = checkHoldout(train, holdout);
    expect(report.status).toBe("outside");
  });
});
