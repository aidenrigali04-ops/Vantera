import { describe, expect, it } from "vitest";
import { snapshotFromRow, gate } from "./entitlement";

describe("snapshotFromRow", () => {
  it("maps snake_case account row to the entitlement snapshot", () => {
    const snap = snapshotFromRow({
      plan: "growth",
      subscription_status: "active",
      seats_purchased: 1,
      linkedin_accounts_purchased: 0,
      current_period_end: "2026-07-13T00:00:00.000Z",
    });
    expect(snap).toEqual({
      plan: "growth",
      subscriptionStatus: "active",
      seatsPurchased: 1,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    });
  });
});

describe("gate", () => {
  const activeRow = {
    plan: "starter",
    subscription_status: "active",
    seats_purchased: 0,
    linkedin_accounts_purchased: 0,
    current_period_end: null,
  };
  it("allows creating a campaign under the limit", () => {
    expect(gate(activeRow, "campaign", 0).ok).toBe(true); // starter maxCampaigns = 1
  });
  it("blocks at the limit", () => {
    const res = gate(activeRow, "campaign", 1);
    expect(res.ok).toBe(false);
  });
  it("blocks when lapsed", () => {
    expect(gate({ ...activeRow, subscription_status: "past_due" }, "campaign", 0).ok).toBe(false);
  });
});
