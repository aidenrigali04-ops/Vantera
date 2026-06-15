import { describe, expect, it } from "vitest";
import {
  PLANS,
  ADDON_PRICES,
  PLAN_PRICE_IDS,
  planForPriceId,
  priceIdFor,
  type PlanTier,
} from "./plans";

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

  it("selects the price id by cadence", () => {
    expect(priceIdFor("growth", "month")).toBe(PLANS.growth.stripePriceId);
    expect(priceIdFor("growth", "year")).toBe(PLANS.growth.stripePriceIdAnnual);
    expect(PLANS.growth.stripePriceId).not.toBe(PLANS.growth.stripePriceIdAnnual);
  });

  it("maps an annual price id back to its tier", () => {
    expect(planForPriceId(PLANS.scale.stripePriceIdAnnual)).toBe("scale");
  });

  it("treats both cadences of every tier as plan price ids", () => {
    for (const t of ["starter", "growth", "scale"] as PlanTier[]) {
      expect(PLAN_PRICE_IDS.has(PLANS[t].stripePriceId)).toBe(true);
      expect(PLAN_PRICE_IDS.has(PLANS[t].stripePriceIdAnnual)).toBe(true);
    }
  });
});
