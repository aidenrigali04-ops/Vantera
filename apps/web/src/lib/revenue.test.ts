import { describe, expect, it } from "vitest";
import { buildRevenueSeries, computeGoalPace, computeRevenueSnapshot } from "./revenue";

const pipeline = { qualified: 10, inOutreach: 8, replied: 4 };

describe("computeGoalPace", () => {
  const NOW = new Date("2026-06-14T00:00:00Z");
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

  it("returns null without a goal or deal value", () => {
    expect(computeGoalPace({ conversionDates: [daysAgo(1)], avgDealValueCents: null, goalCents: 2_000_000, convertedClients: 1, now: NOW })).toBeNull();
    expect(computeGoalPace({ conversionDates: [daysAgo(1)], avgDealValueCents: 500_000, goalCents: null, convertedClients: 1, now: NOW })).toBeNull();
  });

  it("reports reached once closed MRR is at/over the goal", () => {
    const r = computeGoalPace({ conversionDates: [daysAgo(1)], avgDealValueCents: 500_000, goalCents: 2_000_000, convertedClients: 4, now: NOW });
    expect(r).toEqual({ reached: true, etaDays: null });
  });

  it("projects an ETA from the trailing-30-day rate", () => {
    // $5k value, goal $20k, 2 closed = $10k closed, remaining $10k.
    // 2 conversions in the last 30 days → $10k/30d → ~30 days to the remaining $10k.
    const r = computeGoalPace({
      conversionDates: [daysAgo(5), daysAgo(20)],
      avgDealValueCents: 500_000,
      goalCents: 2_000_000,
      convertedClients: 2,
      now: NOW,
    });
    expect(r).toEqual({ reached: false, etaDays: 30 });
  });

  it("returns null when there's no run-rate in the window", () => {
    const r = computeGoalPace({ conversionDates: [daysAgo(90)], avgDealValueCents: 500_000, goalCents: 2_000_000, convertedClients: 1, now: NOW });
    expect(r).toBeNull();
  });
});

describe("computeRevenueSnapshot", () => {
  it("turns counts into dollars when a value is set", () => {
    const s = computeRevenueSnapshot({
      convertedClients: 6,
      pipeline,
      avgDealValueCents: 150_000, // $1,500/mo
      goalCents: 2_000_000, // $20,000/mo
    });
    expect(s.hasValue).toBe(true);
    expect(s.closedCents).toBe(900_000); // 6 × 1,500
    // weighted leads = 10×0.1 + 8×0.25 + 4×0.5 = 1 + 2 + 2 = 5 → 5 × 1,500 = $7,500
    expect(s.expectedCents).toBe(750_000);
    expect(s.closedPctOfGoal).toBe(45); // 9,000 / 20,000
    expect(s.projectedPctOfGoal).toBe(83); // 16,500 / 20,000 → 82.5 → 83
  });

  it("caps progress at 100%", () => {
    const s = computeRevenueSnapshot({
      convertedClients: 100,
      pipeline,
      avgDealValueCents: 150_000,
      goalCents: 1_000_000,
    });
    expect(s.closedPctOfGoal).toBe(100);
    expect(s.projectedPctOfGoal).toBe(100);
  });

  it("reports no value (and $0) when the deal value is unset or zero", () => {
    for (const avgDealValueCents of [null, 0]) {
      const s = computeRevenueSnapshot({
        convertedClients: 6,
        pipeline,
        avgDealValueCents,
        goalCents: 2_000_000,
      });
      expect(s.hasValue).toBe(false);
      expect(s.closedCents).toBe(0);
      expect(s.expectedCents).toBe(0);
    }
  });

  it("returns null progress when there is no goal", () => {
    const s = computeRevenueSnapshot({
      convertedClients: 6,
      pipeline,
      avgDealValueCents: 150_000,
      goalCents: null,
    });
    expect(s.closedPctOfGoal).toBeNull();
    expect(s.projectedPctOfGoal).toBeNull();
  });
});

describe("buildRevenueSeries", () => {
  const now = new Date("2026-06-13T12:00:00Z");

  it("returns an empty series when no value per client is set", () => {
    expect(
      buildRevenueSeries({
        conversionDates: ["2026-06-10T00:00:00Z"],
        avgDealValueCents: null,
        expectedPipelineCents: 50_000,
        now,
      })
    ).toEqual([]);
  });

  it("accumulates closed revenue by conversion date, counting pre-window conversions in the baseline", () => {
    const series = buildRevenueSeries({
      // one before the 7-day window, two inside it
      conversionDates: [
        "2026-06-01T09:00:00Z",
        "2026-06-10T09:00:00Z",
        "2026-06-12T09:00:00Z",
      ],
      avgDealValueCents: 100_000, // $1,000
      expectedPipelineCents: 50_000, // $500
      days: 7,
      now,
    });

    expect(series).toHaveLength(7);
    expect(series[0]?.date).toBe("2026-06-07");
    expect(series.at(-1)?.date).toBe("2026-06-13");

    // baseline from the pre-window conversion, then steps on the 10th and 12th
    expect(series.map((p) => p.closedCents)).toEqual([
      100_000, 100_000, 100_000, 200_000, 200_000, 300_000, 300_000,
    ]);
    // projected = closed + current expected pipeline
    expect(series.at(-1)?.projectedCents).toBe(350_000);
  });
});
