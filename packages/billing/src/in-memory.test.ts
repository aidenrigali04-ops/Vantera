import { describe, expect, it } from "vitest";
import { InMemoryBilling } from "./in-memory";
import { PLANS } from "./plans";

describe("InMemoryBilling", () => {
  const provider = new InMemoryBilling("whsec_test");

  it("returns a checkout url", async () => {
    const { url } = await provider.createCheckoutSession({
      accountId: "acc_1",
      stripeCustomerId: null,
      customerEmail: "a@b.com",
      tier: "growth",
      seatAddons: 0,
      linkedinAddons: 0,
      successUrl: "https://app/ok",
      cancelUrl: "https://app/no",
    });
    expect(url).toContain("https://");
  });

  it("returns a portal url", async () => {
    const { url } = await provider.createPortalSession({
      stripeCustomerId: "cus_1",
      returnUrl: "https://app/billing",
    });
    expect(url).toContain("https://");
  });

  it("verifies by plain signature equality and rejects forgeries", () => {
    const body = JSON.stringify({ id: "evt_1", type: "subscription_updated" });
    expect(() => provider.verifyWebhook(body, "whsec_test")).not.toThrow();
    expect(() => provider.verifyWebhook(body, "wrong")).toThrow();
  });

  it("parses a fake subscription_updated event", () => {
    const raw = {
      id: "evt_2",
      type: "subscription_updated",
      customer: "cus_9",
      subscription: "sub_9",
      status: "active",
      planPriceId: PLANS.starter.stripePriceId,
      seats: 0,
      linkedin: 0,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
    };
    expect(provider.webhookEventId(raw)).toBe("evt_2");
    const parsed = provider.parseWebhook(raw);
    expect(parsed).toMatchObject({ type: "subscription_updated", stripeCustomerId: "cus_9" });
  });
});
