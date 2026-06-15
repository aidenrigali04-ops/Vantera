import { describe, expect, it } from "vitest";
import { shapePipeline } from "./queries";

describe("shapePipeline", () => {
  it("counts active runs per stage and computes goal progress from real deal value", () => {
    const vm = shapePipeline({
      runs: [
        { current_stage: "linkedin", status: "active" },
        { current_stage: "linkedin", status: "active" },
        { current_stage: "email", status: "active" },
        { current_stage: "call", status: "active" },
        { current_stage: "email", status: "paused_reply" },
        { current_stage: "done", status: "converted" },
      ],
      convertedClients: 1,
      avgDealValueCents: 500_000, // $5,000
      revenueGoalCents: 2_000_000, // $20,000/mo
    });
    expect(vm.stages).toEqual([
      { stage: "linkedin", label: "LinkedIn", count: 2 },
      { stage: "email", label: "Email", count: 1 },
      { stage: "imessage", label: "iMessage", count: 0 },
      { stage: "call", label: "Caller", count: 1 },
    ]);
    expect(vm.activeTotal).toBe(4);
    expect(vm.pausedTotal).toBe(1);
    expect(vm.pipelineValueCents).toBe(500_000);
    expect(vm.goalProgressPct).toBe(25);
  });

  it("clamps goal progress at 100 and returns null when there is no goal", () => {
    const capped = shapePipeline({
      runs: [],
      convertedClients: 10,
      avgDealValueCents: 500_000,
      revenueGoalCents: 1_000_000,
    });
    expect(capped.goalProgressPct).toBe(100);

    const noGoal = shapePipeline({
      runs: [],
      convertedClients: 3,
      avgDealValueCents: 500_000,
      revenueGoalCents: null,
    });
    expect(noGoal.goalProgressPct).toBeNull();
  });

  it("handles an empty pipeline", () => {
    const vm = shapePipeline({
      runs: [],
      convertedClients: 0,
      avgDealValueCents: null,
      revenueGoalCents: 2_000_000,
    });
    expect(vm.activeTotal).toBe(0);
    expect(vm.pipelineValueCents).toBe(0);
    expect(vm.goalProgressPct).toBe(0);
  });
});
