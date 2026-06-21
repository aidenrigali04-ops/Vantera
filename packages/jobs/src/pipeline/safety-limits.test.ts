import { describe, expect, it } from "vitest";
import {
  LINKEDIN_WEEKLY_INVITE_CEILING,
  LINKEDIN_STEADY_DAILY_INVITES,
  LINKEDIN_STEADY_DAILY_MESSAGES,
  dailyAllowance,
  paceWithJitter,
} from "./safety-limits";

describe("dailyAllowance", () => {
  it("ramps new linkedin accounts well below steady state", () => {
    expect(dailyAllowance("linkedin", 0)).toBeLessThanOrEqual(5);
    expect(dailyAllowance("linkedin", 10)).toBeLessThan(LINKEDIN_STEADY_DAILY_INVITES);
    expect(dailyAllowance("linkedin", 60)).toBe(LINKEDIN_STEADY_DAILY_INVITES);
  });

  it("keeps a steady linkedin week at or under the ~100 invite ceiling", () => {
    expect(LINKEDIN_STEADY_DAILY_INVITES * 5).toBeLessThanOrEqual(LINKEDIN_WEEKLY_INVITE_CEILING);
  });

  it("clamps user-requested volumes to the safety ceiling (non-configurable above)", () => {
    expect(dailyAllowance("linkedin", 60, { requested: 500 })).toBe(LINKEDIN_STEADY_DAILY_INVITES);
  });

  it("lets users request LESS than the ceiling", () => {
    expect(dailyAllowance("linkedin", 60, { requested: 3 })).toBe(3);
  });

  it("never returns a negative allowance", () => {
    expect(dailyAllowance("linkedin", -5)).toBeGreaterThanOrEqual(0);
    expect(dailyAllowance("linkedin", 60, { requested: -10 })).toBe(0);
  });
});

describe("paceWithJitter", () => {
  it("is deterministic for a given seed", () => {
    expect(paceWithJitter(60_000, 7)).toBe(paceWithJitter(60_000, 7));
  });

  it("stays within ±30% of the base interval and is never negative", () => {
    for (let seed = 0; seed < 50; seed++) {
      const v = paceWithJitter(60_000, seed);
      expect(v).toBeGreaterThanOrEqual(42_000);
      expect(v).toBeLessThanOrEqual(78_000);
    }
  });
});

describe("linkedin message cap", () => {
  it("caps messages at the steady daily cap regardless of account age", () => {
    expect(dailyAllowance("linkedin", 365, { kind: "message" })).toBe(LINKEDIN_STEADY_DAILY_MESSAGES);
    expect(dailyAllowance("linkedin", 3, { kind: "message" })).toBe(LINKEDIN_STEADY_DAILY_MESSAGES);
  });
  it("requested lowers but never raises the message cap", () => {
    expect(dailyAllowance("linkedin", 365, { requested: 10, kind: "message" })).toBe(10);
    expect(dailyAllowance("linkedin", 365, { requested: 500, kind: "message" })).toBe(
      LINKEDIN_STEADY_DAILY_MESSAGES
    );
  });
  it("defaults to invite behavior when kind is omitted", () => {
    expect(dailyAllowance("linkedin", 3)).toBe(5); // ramp step unchanged
  });
});
