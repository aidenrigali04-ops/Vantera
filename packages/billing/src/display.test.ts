import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { PLAN_DISPLAY, PLAN_DISPLAY_ORDER, breakEvenCloses } from "./display";

describe("breakEvenCloses", () => {
  it("returns closed deals needed to cover a year at monthly billing", () => {
    expect(breakEvenCloses(349, 5000, "month")).toBe(1); // $4,188/yr ÷ $5k → 1
    expect(breakEvenCloses(349, 1000, "month")).toBe(5); // $4,188/yr ÷ $1k → 5
  });

  it("needs fewer closes on annual billing (two months free)", () => {
    expect(breakEvenCloses(349, 1000, "year")).toBe(4); // $3,490/yr ÷ $1k → 4
  });

  it("returns null without a positive deal value (no fabricated payback)", () => {
    expect(breakEvenCloses(349, 0, "month")).toBeNull();
    expect(breakEvenCloses(349, -100, "month")).toBeNull();
  });
});

describe("plan display", () => {
  it("exposes exactly one center-stage plan", () => {
    const highlighted = PLAN_DISPLAY_ORDER.filter((t) => PLAN_DISPLAY[t].highlight);
    expect(highlighted).toEqual(["growth"]);
  });

  it("prices ascend with tier", () => {
    const prices = PLAN_DISPLAY_ORDER.map((t) => PLAN_DISPLAY[t].monthlyUsd);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("only surfaces the Intent Agent where the entitlement actually unlocks it", () => {
    for (const tier of PLAN_DISPLAY_ORDER) {
      const claimsIntent = PLAN_DISPLAY[tier].features.some((f) => /Intent Agent/i.test(f));
      expect(claimsIntent).toBe(PLANS[tier].features.intent);
    }
  });

  it("derives capacity bullets from the real entitlement numbers", () => {
    for (const tier of PLAN_DISPLAY_ORDER) {
      const f = PLAN_DISPLAY[tier].features;
      expect(
        f.some((b) => b.includes(`${PLANS[tier].includedLinkedinAccounts} LinkedIn sender`))
      ).toBe(true);
      const campaigns = PLANS[tier].maxCampaigns;
      const expected = campaigns >= 999 ? "Unlimited active campaigns" : `${campaigns} active campaign`;
      expect(f.some((b) => b.includes(expected))).toBe(true);
    }
  });
});
