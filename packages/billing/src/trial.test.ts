import { describe, expect, it } from "vitest";
import { TRIAL_TIER, TRIAL_DAYS, trialDaysLeft, isTrialExpired } from "./trial";
import { PLANS } from "./plans";
import { isActive } from "./entitlements";

const now = new Date("2026-06-14T00:00:00.000Z");

describe("trial", () => {
  it("trials on a real tier so the gate (isActive + plan!='none') passes", () => {
    expect(PLANS[TRIAL_TIER]).toBeDefined();
    expect(TRIAL_TIER).not.toBe("none");
    expect(isActive("trialing")).toBe(true);
  });

  it("counts whole days left, rounded up and floored at zero", () => {
    expect(trialDaysLeft("2026-06-24T00:00:00.000Z", now)).toBe(10);
    expect(trialDaysLeft("2026-06-14T06:00:00.000Z", now)).toBe(1);
    expect(trialDaysLeft("2026-06-01T00:00:00.000Z", now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBeNull();
  });

  it("a fresh trial spans TRIAL_DAYS", () => {
    const ends = new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
    expect(trialDaysLeft(ends, now)).toBe(TRIAL_DAYS);
  });

  it("expires only once the end date has passed", () => {
    expect(isTrialExpired("2026-06-13T23:59:59.000Z", now)).toBe(true);
    expect(isTrialExpired("2026-06-15T00:00:00.000Z", now)).toBe(false);
    expect(isTrialExpired(null, now)).toBe(false);
  });
});
