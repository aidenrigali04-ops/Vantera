import { describe, expect, it } from "vitest";
import {
  onboardingProgressPercent,
  resolveOnboardingStep,
  type OnboardingContext,
} from "./onboarding-gate";

const ctx = (over: Partial<OnboardingContext>): OnboardingContext => ({
  hasAccount: false,
  detailsConfirmed: false,
  buyersConfirmed: false,
  prospectsReviewed: false,
  subscribed: false,
  onboardingComplete: false,
  ...over,
});

describe("resolveOnboardingStep", () => {
  const acct = { hasAccount: true, detailsConfirmed: true };

  it("starts at Details with no account", () => {
    expect(resolveOnboardingStep(ctx({}))).toBe(1);
  });

  it("stays on Details until the details are saved, even with an account row", () => {
    expect(resolveOnboardingStep(ctx({ hasAccount: true }))).toBe(1);
  });

  it("moves to Buyers once details are in", () => {
    expect(resolveOnboardingStep(ctx(acct))).toBe(2);
  });

  it("moves to Prospects once buyers are confirmed", () => {
    expect(resolveOnboardingStep(ctx({ ...acct, buyersConfirmed: true }))).toBe(3);
  });

  it("moves to Plan once prospects are reviewed", () => {
    expect(
      resolveOnboardingStep(ctx({ ...acct, buyersConfirmed: true, prospectsReviewed: true }))
    ).toBe(4);
  });

  it("is done once subscribed", () => {
    expect(
      resolveOnboardingStep(
        ctx({ ...acct, buyersConfirmed: true, prospectsReviewed: true, subscribed: true })
      )
    ).toBe("done");
  });

  it("never re-enters a completed onboarding, whatever else is missing", () => {
    expect(resolveOnboardingStep(ctx({ onboardingComplete: true }))).toBe("done");
  });

  it("a legacy context that connected LinkedIn but never confirmed buyers resolves to 2", () => {
    const legacy = { ...ctx(acct), linkedinConnected: true } as OnboardingContext;
    expect(resolveOnboardingStep(legacy)).toBe(2);
  });
});

describe("onboardingProgressPercent", () => {
  it("opens at 20% (endowed account segment) and advances by fifths", () => {
    expect(onboardingProgressPercent(1)).toBe(20);
    expect(onboardingProgressPercent(2)).toBe(40);
    expect(onboardingProgressPercent(3)).toBe(60);
    expect(onboardingProgressPercent(4)).toBe(80);
    expect(onboardingProgressPercent("done")).toBe(100);
  });
});
