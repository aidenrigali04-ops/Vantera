import { describe, expect, it } from "vitest";
import { snapshotFromEvent } from "./webhook";
import { PLANS } from "./plans";
import type { ParsedWebhookEvent } from "./types";

describe("snapshotFromEvent", () => {
  it("maps a subscription_updated event to a full snapshot", () => {
    const event: ParsedWebhookEvent = {
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: PLANS.growth.stripePriceId,
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    };
    expect(snapshotFromEvent(event)).toEqual({
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      plan: "growth",
      subscriptionStatus: "active",
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    });
  });

  it("maps a cancellation to a none/canceled snapshot", () => {
    const snap = snapshotFromEvent({
      type: "subscription_canceled",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
    });
    expect(snap).toMatchObject({ plan: "none", subscriptionStatus: "canceled" });
  });

  it("returns null for ignored events", () => {
    expect(snapshotFromEvent({ type: "ignored" })).toBeNull();
  });

  it("falls back to none plan when the price id is unknown", () => {
    const snap = snapshotFromEvent({
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: "price_unknown",
      seatsPurchased: 0,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: null,
    });
    expect(snap?.plan).toBe("none");
  });
});
