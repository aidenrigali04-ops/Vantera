import { describe, expect, it } from "vitest";
import {
  humanizeEmailStatus,
  humanizePhoneStatus,
  isVerified,
  projectedRevenue,
  scoreVerdict,
} from "./lead-value";

describe("scoreVerdict", () => {
  it("tiers a score into a felt verdict", () => {
    expect(scoreVerdict(92).tier).toBe("hot");
    expect(scoreVerdict(85).tier).toBe("hot");
    expect(scoreVerdict(84).tier).toBe("strong");
    expect(scoreVerdict(70).tier).toBe("strong");
    expect(scoreVerdict(69).tier).toBe("look");
    expect(scoreVerdict(0).tier).toBe("look");
  });

  it("handles an unscored lead", () => {
    expect(scoreVerdict(null)).toEqual({ tier: "unscored", label: "Not scored yet" });
  });
});

describe("projectedRevenue", () => {
  it("returns full deal value and deals-to-goal", () => {
    expect(projectedRevenue(400000, 5000000)).toEqual({ valueCents: 400000, dealsToGoal: 13 });
  });

  it("floors deals-to-goal at 1 when a single deal clears the goal", () => {
    expect(projectedRevenue(6000000, 5000000)).toEqual({ valueCents: 6000000, dealsToGoal: 1 });
  });

  it("omits deals-to-goal when no goal is set", () => {
    expect(projectedRevenue(400000, null)).toEqual({ valueCents: 400000, dealsToGoal: null });
  });

  it("hides the pill when there is no deal value", () => {
    expect(projectedRevenue(null, 5000000)).toBeNull();
    expect(projectedRevenue(0, 5000000)).toBeNull();
  });
});

describe("status humanizers", () => {
  it("maps email + phone enums to plain language", () => {
    expect(humanizeEmailStatus("valid")).toBe("Verified");
    expect(humanizeEmailStatus("risky")).toBe("Risky");
    expect(humanizePhoneStatus("unvalidated")).toBe("Unvalidated");
  });

  it("treats only valid as verified", () => {
    expect(isVerified("valid")).toBe(true);
    expect(isVerified("unverified")).toBe(false);
  });
});
