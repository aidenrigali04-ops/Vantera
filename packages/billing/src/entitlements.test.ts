import { describe, expect, it } from "vitest";
import {
  resolveEntitlements,
  checkLimit,
  isActive,
  type EntitlementSnapshot,
} from "./entitlements";

const base: EntitlementSnapshot = {
  plan: "growth",
  subscriptionStatus: "active",
  seatsPurchased: 2,
  linkedinAccountsPurchased: 1,
  currentPeriodEnd: "2026-07-13T00:00:00.000Z",
};

describe("resolveEntitlements", () => {
  it("adds purchased seats on top of the tier base", () => {
    const limits = resolveEntitlements(base);
    expect(limits.maxSeats).toBe(3 + 2); // growth base 3 + 2 add-on
    expect(limits.maxLinkedinAccounts).toBe(1);
    expect(limits.maxCampaigns).toBe(5);
  });

  it("grants nothing when there is no active plan", () => {
    const limits = resolveEntitlements({ ...base, plan: "none", subscriptionStatus: "none" });
    expect(limits.maxSeats).toBe(0);
    expect(limits.maxCampaigns).toBe(0);
    expect(limits.maxLinkedinAccounts).toBe(0);
  });

  it("treats past_due / canceled as inactive (no new capacity)", () => {
    expect(isActive("active")).toBe(true);
    expect(isActive("trialing")).toBe(true);
    expect(isActive("past_due")).toBe(false);
    expect(isActive("canceled")).toBe(false);
    expect(resolveEntitlements({ ...base, subscriptionStatus: "past_due" }).maxCampaigns).toBe(0);
  });
});

describe("checkLimit", () => {
  it("allows creating below the limit", () => {
    expect(checkLimit("campaign", 4, resolveEntitlements(base)).allowed).toBe(true);
  });
  it("blocks at the limit with a reason", () => {
    const res = checkLimit("campaign", 5, resolveEntitlements(base));
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/limit/i);
  });
  it("blocks everything when inactive", () => {
    const limits = resolveEntitlements({ ...base, subscriptionStatus: "canceled" });
    expect(checkLimit("campaign", 0, limits).allowed).toBe(false);
  });
});
