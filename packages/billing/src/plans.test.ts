import { describe, expect, it } from "vitest";
import { PLANS, ADDON_PRICES, planForPriceId, type PlanTier } from "./plans";

describe("plans config", () => {
  it("defines the three tiers with ascending base limits", () => {
    const tiers: PlanTier[] = ["starter", "growth", "scale"];
    for (const t of tiers) expect(PLANS[t]).toBeDefined();
    expect(PLANS.growth.maxCampaigns).toBeGreaterThan(PLANS.starter.maxCampaigns);
    expect(PLANS.scale.includedSeats).toBeGreaterThan(PLANS.growth.includedSeats);
  });

  it("maps a Stripe price id back to its tier", () => {
    const priceId = PLANS.growth.stripePriceId;
    expect(planForPriceId(priceId)).toBe("growth");
    expect(planForPriceId("price_does_not_exist")).toBeNull();
  });

  it("exposes the two add-on price ids", () => {
    expect(ADDON_PRICES.seat).toBeTruthy();
    expect(ADDON_PRICES.linkedinAccount).toBeTruthy();
  });
});
