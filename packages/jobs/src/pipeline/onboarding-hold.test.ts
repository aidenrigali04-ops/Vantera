import { describe, expect, it } from "vitest";
import { isHeldForOnboarding } from "./onboarding-hold";

describe("isHeldForOnboarding", () => {
  it("holds an account that has not finished onboarding", () =>
    expect(isHeldForOnboarding({ onboardingCompletedAt: null })).toBe(true));
  it("releases on completion regardless of subscription (founder/dev bypass)", () =>
    expect(isHeldForOnboarding({ onboardingCompletedAt: new Date("2026-10-22T00:00:00Z") })).toBe(false));
});
