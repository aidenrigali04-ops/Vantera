import { describe, expect, it } from "vitest";
import {
  dataFreshness,
  humanizeEmailStatus,
  humanizePhoneStatus,
  isVerified,
  projectedRevenue,
  scoreVerdict,
  FRESHNESS_STALE_DAYS,
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
  it("returns deal value and deals-to-goal for a qualified lead", () => {
    expect(projectedRevenue(400000, 5000000, 80)).toEqual({ valueCents: 400000, dealsToGoal: 13 });
  });

  it("floors deals-to-goal at 1 when a single deal clears the goal", () => {
    expect(projectedRevenue(6000000, 5000000, 90)).toEqual({ valueCents: 6000000, dealsToGoal: 1 });
  });

  it("omits deals-to-goal when no goal is set", () => {
    expect(projectedRevenue(400000, null, 75)).toEqual({ valueCents: 400000, dealsToGoal: null });
  });

  it("hides the pill when there is no deal value", () => {
    expect(projectedRevenue(null, 5000000, 90)).toBeNull();
    expect(projectedRevenue(0, 5000000, 90)).toBeNull();
  });

  it("never dangles a value on a lead that hasn't cleared the qualification bar (report #2/#4)", () => {
    expect(projectedRevenue(400000, 5000000, 69)).toBeNull();
    expect(projectedRevenue(400000, 5000000, null)).toBeNull();
  });
});

describe("dataFreshness", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("returns null when the lead was never scored", () => {
    expect(dataFreshness(null, now)).toBeNull();
  });

  it("labels recent research and marks it fresh", () => {
    expect(dataFreshness("2026-06-16T09:00:00Z", now)).toEqual({ label: "today", stale: false });
    expect(dataFreshness("2026-06-13T12:00:00Z", now)).toEqual({ label: "3d ago", stale: false });
  });

  it("flags research older than the freshness window as stale (report #9)", () => {
    const old = new Date(now.getTime() - (FRESHNESS_STALE_DAYS + 5) * 86_400_000).toISOString();
    const f = dataFreshness(old, now);
    expect(f?.stale).toBe(true);
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
