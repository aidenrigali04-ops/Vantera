import { describe, expect, it } from "vitest";
import {
  onboardingProgressPercent,
  resolveOnboardingStep,
  type OnboardingContext,
} from "./onboarding-gate";

const ctx = (over: Partial<OnboardingContext>): OnboardingContext => ({
  hasAccount: false,
  detailsConfirmed: false,
  linkedinConnected: false,
  subscribed: false,
  onboardingComplete: false,
  ...over,
});

describe("resolveOnboardingStep", () => {
  it("starts at Details with no account", () => {
    expect(resolveOnboardingStep(ctx({}))).toBe(1);
  });

  it("stays on Details until the details are saved, even with an account row", () => {
    expect(resolveOnboardingStep(ctx({ hasAccount: true }))).toBe(1);
  });

  it("moves to LinkedIn once details are in", () => {
    expect(resolveOnboardingStep(ctx({ hasAccount: true, detailsConfirmed: true }))).toBe(2);
  });

  it("moves to Subscription once LinkedIn is connected (connecting counts)", () => {
    expect(
      resolveOnboardingStep(ctx({ hasAccount: true, detailsConfirmed: true, linkedinConnected: true }))
    ).toBe(3);
  });

  it("is done once subscribed — the page finishes provisioning and leaves", () => {
    expect(
      resolveOnboardingStep(
        ctx({ hasAccount: true, detailsConfirmed: true, linkedinConnected: true, subscribed: true })
      )
    ).toBe("done");
  });

  it("never re-enters a completed onboarding, whatever else is missing", () => {
    expect(resolveOnboardingStep(ctx({ onboardingComplete: true }))).toBe("done");
  });

  it("a returning user lands on the furthest incomplete step, never an earlier one", () => {
    // LinkedIn connected but details somehow missing → details first (the scan feeds the ICP)
    expect(resolveOnboardingStep(ctx({ hasAccount: true, linkedinConnected: true }))).toBe(1);
  });
});

describe("onboardingProgressPercent", () => {
  it("opens at 25% (endowed account segment) and advances by quarters", () => {
    expect(onboardingProgressPercent(1)).toBe(25);
    expect(onboardingProgressPercent(2)).toBe(50);
    expect(onboardingProgressPercent(3)).toBe(75);
    expect(onboardingProgressPercent("done")).toBe(100);
  });
});
