import { describe, expect, it } from "vitest";
import {
  benchmarkForStage,
  buildRevenueSeries,
  computeFunnel,
  computeGoalPace,
  computeRevenueSnapshot,
  computeRoi,
} from "./revenue";

describe("benchmarkForStage", () => {
  it("marks a reply rate inside the typical quality-outreach band as healthy", () => {
    expect(benchmarkForStage("replied", 12)).toEqual({ low: 8, high: 20, status: "healthy" });
  });

  it("flags below and above the band", () => {
    expect(benchmarkForStage("replied", 5)?.status).toBe("below");
    expect(benchmarkForStage("replied", 25)?.status).toBe("above");
  });

  it("benchmarks the meeting and close transitions too", () => {
    expect(benchmarkForStage("meetings", 40)?.status).toBe("healthy");
    expect(benchmarkForStage("closed", 30)?.status).toBe("healthy");
  });

  it("has no benchmark for throughput stages or missing data", () => {
    expect(benchmarkForStage("contacted", 80)).toBeNull(); // qualified→contacted is throughput, not quality
    expect(benchmarkForStage("qualified", null)).toBeNull();
    expect(benchmarkForStage("replied", null)).toBeNull();
  });
});

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

describe("computeFunnel", () => {
  it("orders the revenue stages and computes stage-to-stage conversion", () => {
    const f = computeFunnel({ qualified: 100, contacted: 80, replied: 20, meetings: 10, closed: 4 });
    expect(f.map((s) => s.key)).toEqual([
      "qualified",
      "contacted",
      "replied",
      "meetings",
      "closed",
    ]);
    expect(f.map((s) => s.count)).toEqual([100, 80, 20, 10, 4]);
    expect(f[0]!.conversionPct).toBeNull(); // first stage has no predecessor
    expect(f[1]!.conversionPct).toBe(80); // 80/100
    expect(f[2]!.conversionPct).toBe(25); // 20/80
    expect(f[3]!.conversionPct).toBe(50); // 10/20
    expect(f[4]!.conversionPct).toBe(40); // 4/10
  });

  it("returns null conversion (never divides by zero) when a stage is empty", () => {
    const f = computeFunnel({ qualified: 0, contacted: 0, replied: 0, meetings: 0, closed: 0 });
    expect(f.every((s) => s.conversionPct === null)).toBe(true);
  });
});

describe("computeRoi", () => {
  it("computes annual pipeline-to-spend, the 2x threshold, and cost per meeting/close", () => {
    // Growth plan $349/mo → $4,188/yr; pipeline $10,476 → ratio 2.5 (clears 2x).
    const r = computeRoi({
      closedCents: 1_000_000,
      pipelineCents: 47_600,
      planMonthlyCents: 34_900,
      meetings: 5,
      closes: 2,
    });
    expect(r.hasSpend).toBe(true);
    expect(r.annualSpendCents).toBe(418_800);
    expect(r.pipelineToSpend).toBe(2.5);
    expect(r.meetsThreshold).toBe(true);
    expect(r.costPerMeetingCents).toBe(6_980); // 34,900 / 5
    expect(r.costPerCloseCents).toBe(17_450); // 34,900 / 2
  });

  it("flags when pipeline is under 2x spend, and nulls cost-per-close with no closes", () => {
    const r = computeRoi({
      closedCents: 0,
      pipelineCents: 100_000,
      planMonthlyCents: 89_900,
      meetings: 1,
      closes: 0,
    });
    expect(r.meetsThreshold).toBe(false);
    expect(r.costPerCloseCents).toBeNull();
  });

  it("returns null ratio and costs when there is no plan price", () => {
    const r = computeRoi({
      closedCents: 500_000,
      pipelineCents: 0,
      planMonthlyCents: null,
      meetings: 3,
      closes: 1,
    });
    expect(r.hasSpend).toBe(false);
    expect(r.pipelineToSpend).toBeNull();
    expect(r.meetsThreshold).toBeNull();
    expect(r.costPerMeetingCents).toBeNull();
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
