import { describe, expect, it } from "vitest";
import { shapePipeline } from "./queries";

const EMPTY_COUNTS = { qualified: 0, inOutreach: 0, replied: 0 };

describe("shapePipeline (T1: same revenue meanings as the Overview)", () => {
  it("counts active/paused runs and computes goal progress from CLOSED revenue", () => {
    const vm = shapePipeline({
      runs: [
        { current_stage: "linkedin", status: "active" },
        { current_stage: "linkedin", status: "active" },
        { current_stage: "linkedin", status: "paused_reply" },
        { current_stage: "done", status: "converted" },
      ],
      counts: EMPTY_COUNTS,
      convertedClients: 1,
      closedActualCents: 0, // no typed deal values → avg×count estimate
      avgDealValueCents: 500_000, // $5,000
      revenueGoalCents: 2_000_000, // $20,000/mo
    });
    expect(vm.activeTotal).toBe(2);
    expect(vm.pausedTotal).toBe(1);
    expect(vm.closedCents).toBe(500_000);
    expect(vm.goalProgressPct).toBe(25);
  });

  it("expectedCents is the stage-weighted pipeline, distinct from closed", () => {
    const vm = shapePipeline({
      runs: [],
      counts: { qualified: 10, inOutreach: 4, replied: 2 },
      convertedClients: 0,
      closedActualCents: 0,
      avgDealValueCents: 100_000,
      revenueGoalCents: null,
    });
    expect(vm.closedCents).toBe(0);
    expect(vm.expectedCents).toBeGreaterThan(0);
    expect(vm.goalProgressPct).toBeNull();
  });

  it("real typed deal values beat the avg×count estimate", () => {
    const vm = shapePipeline({
      runs: [],
      counts: EMPTY_COUNTS,
      convertedClients: 2,
      closedActualCents: 1_250_000, // $12,500 in actuals
      avgDealValueCents: 500_000,
      revenueGoalCents: 2_500_000,
    });
    expect(vm.closedCents).toBe(1_250_000);
    expect(vm.goalProgressPct).toBe(50);
  });

  it("clamps goal progress at 100 and handles an empty pipeline", () => {
    const capped = shapePipeline({
      runs: [],
      counts: EMPTY_COUNTS,
      convertedClients: 10,
      closedActualCents: 0,
      avgDealValueCents: 500_000,
      revenueGoalCents: 1_000_000,
    });
    expect(capped.goalProgressPct).toBe(100);

    const empty = shapePipeline({
      runs: [],
      counts: EMPTY_COUNTS,
      convertedClients: 0,
      closedActualCents: 0,
      avgDealValueCents: null,
      revenueGoalCents: 2_000_000,
    });
    expect(empty.activeTotal).toBe(0);
    expect(empty.closedCents).toBe(0);
    expect(empty.expectedCents).toBe(0);
    expect(empty.goalProgressPct).toBe(0);
  });
});
