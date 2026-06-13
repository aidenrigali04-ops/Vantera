import { describe, expect, it } from "vitest";
import { StripeBilling } from "./stripe";
import { PLANS, ADDON_PRICES } from "./plans";

const adapter = new StripeBilling("sk_test_x", "whsec_x");

describe("StripeBilling.parseWebhook", () => {
  it("maps customer.subscription.updated to subscription_updated with add-on quantities", () => {
    const raw = {
      id: "evt_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_1",
          id: "sub_1",
          status: "active",
          current_period_end: 1768262400,
          metadata: { accountId: "acc_123" },
          items: {
            data: [
              {
                price: { id: PLANS.growth.stripePriceId },
                quantity: 1,
                current_period_end: 1768262400,
              },
              { price: { id: ADDON_PRICES.seat }, quantity: 2 },
              { price: { id: ADDON_PRICES.linkedinAccount }, quantity: 1 },
            ],
          },
        },
      },
    };
    const parsed = adapter.parseWebhook(raw);
    expect(parsed).toMatchObject({
      type: "subscription_updated",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      status: "active",
      planPriceId: PLANS.growth.stripePriceId,
      seatsPurchased: 2,
      linkedinAccountsPurchased: 1,
      accountId: "acc_123",
    });
    if (parsed.type !== "subscription_updated") throw new Error("expected subscription_updated");
    expect(parsed.currentPeriodEnd).toBe(new Date(1768262400 * 1000).toISOString());
  });

  it("maps customer.subscription.deleted to subscription_canceled", () => {
    const parsed = adapter.parseWebhook({
      id: "evt_2",
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_1", id: "sub_1" } },
    });
    expect(parsed.type).toBe("subscription_canceled");
  });

  it("ignores unrelated events", () => {
    expect(adapter.parseWebhook({ id: "e", type: "charge.succeeded", data: { object: {} } }).type).toBe("ignored");
  });
});
