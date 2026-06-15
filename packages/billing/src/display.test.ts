import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { PLAN_DISPLAY, PLAN_DISPLAY_ORDER } from "./display";

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

  it("only surfaces the AI Cold Caller where the entitlement actually unlocks it", () => {
    for (const tier of PLAN_DISPLAY_ORDER) {
      const claimsCaller = PLAN_DISPLAY[tier].features.some((f) => /AI Cold Caller/i.test(f));
      expect(claimsCaller).toBe(PLANS[tier].features.aiCaller);
    }
  });

  it("derives capacity bullets from the real entitlement numbers", () => {
    for (const tier of PLAN_DISPLAY_ORDER) {
      const f = PLAN_DISPLAY[tier].features;
      expect(f.some((b) => b.includes(`${PLANS[tier].maxMailboxes} sending mailboxes`))).toBe(true);
      expect(f.some((b) => b.includes(`${PLANS[tier].maxCampaigns} active campaign`))).toBe(true);
    }
  });
});
