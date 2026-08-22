import { describe, expect, it } from "vitest";
import {
  coolingState,
  dataFreshness,
  humanizeEmailStatus,
  humanizePhoneStatus,
  isVerified,
  lastActivity,
  leadSignalLine,
  projectedRevenue,
  scoreVerdict,
  topLeadSignal,
  whyNowSignal,
  COOLING_DAYS,
  FRESHNESS_STALE_DAYS,
} from "./lead-value";

describe("lastActivity", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("prefers the latest reply over scoring and sourcing", () => {
    expect(
      lastActivity("2026-06-14T12:00:00Z", "2026-06-10T12:00:00Z", "2026-06-01T12:00:00Z", now)
    ).toEqual({ kind: "reply", label: "Replied 2d ago" });
  });

  it("falls back to the scoring pass when no reply has landed", () => {
    expect(lastActivity(null, "2026-06-16T09:00:00Z", "2026-06-01T12:00:00Z", now)).toEqual({
      kind: "scored",
      label: "Researched today",
    });
  });

  it("falls back to sourcing when the lead was never scored", () => {
    expect(lastActivity(null, null, "2026-05-16T12:00:00Z", now)).toEqual({
      kind: "sourced",
      label: "Sourced 4w ago",
    });
  });

  it("returns null when nothing is dated (never fabricates a timestamp)", () => {
    expect(lastActivity(null, null, null, now)).toBeNull();
    expect(lastActivity("not-a-date", null, null, now)).toBeNull();
  });
});

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

describe("whyNowSignal", () => {
  it("prefers a timing trigger over a pain point", () => {
    expect(
      whyNowSignal({ triggers: ["Raised a Series B"], pain_points: ["Manual reporting"] })
    ).toBe("Raised a Series B");
  });

  it("falls back to the top pain point when there is no trigger", () => {
    expect(whyNowSignal({ triggers: [], pain_points: ["Manual reporting"] })).toBe(
      "Manual reporting"
    );
    expect(whyNowSignal({ pain_points: ["Manual reporting"] })).toBe("Manual reporting");
  });

  it("returns null rather than a filler line when there's nothing to say", () => {
    expect(whyNowSignal(null)).toBeNull();
    expect(whyNowSignal(undefined)).toBeNull();
    expect(whyNowSignal({ triggers: [], pain_points: [] })).toBeNull();
  });
});

describe("topLeadSignal", () => {
  it("returns the freshest signal by observed_at", () => {
    const s = topLeadSignal([
      { kind: "hiring", label: "Hiring", observed_at: "2026-05-01" },
      { kind: "funding", label: "Raised a round", observed_at: "2026-06-10" },
    ]);
    expect(s?.kind).toBe("funding");
  });

  it("is null-safe on empty/missing input", () => {
    expect(topLeadSignal(null)).toBeNull();
    expect(topLeadSignal([])).toBeNull();
  });
});

describe("leadSignalLine", () => {
  it("prefers a real captured signal over the AI-derived trigger", () => {
    expect(
      leadSignalLine(
        [{ kind: "funding", label: "Raised a Series B", observed_at: "2026-06-10" }],
        { triggers: ["AI guessed something"] }
      )
    ).toBe("Raised a Series B");
  });

  it("falls back to the AI insight when there's no real signal", () => {
    expect(leadSignalLine([], { triggers: ["Hiring an RevOps lead"] })).toBe("Hiring an RevOps lead");
    expect(leadSignalLine(null, { pain_points: ["Manual reporting"] })).toBe("Manual reporting");
  });

  it("returns null when neither source has anything", () => {
    expect(leadSignalLine(null, null)).toBeNull();
  });
});

describe("coolingState", () => {
  const now = new Date("2026-06-16T12:00:00Z");

  it("flags a replied lead whose reply has waited at least COOLING_DAYS", () => {
    const waited = new Date(now.getTime() - (COOLING_DAYS + 1) * 86_400_000).toISOString();
    expect(coolingState("replied", waited, now)).toEqual({
      daysWaiting: COOLING_DAYS + 1,
      label: `Reply waiting ${COOLING_DAYS + 1}d`,
    });
  });

  it("stays quiet until the cooling window passes", () => {
    const fresh = new Date(now.getTime() - 1 * 86_400_000).toISOString();
    expect(coolingState("replied", fresh, now)).toBeNull();
  });

  it("only cools warm, unconverted leads", () => {
    const old = new Date(now.getTime() - 10 * 86_400_000).toISOString();
    expect(coolingState("converted", old, now)).toBeNull();
    expect(coolingState("in_campaign", old, now)).toBeNull();
  });

  it("returns null when there's no reply timestamp", () => {
    expect(coolingState("replied", null, now)).toBeNull();
    expect(coolingState("replied", undefined, now)).toBeNull();
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
