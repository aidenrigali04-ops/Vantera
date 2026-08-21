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

describe("StripeBilling.createCheckoutSession", () => {
  function capture() {
    const calls: Array<Record<string, unknown>> = [];
    const fake = new StripeBilling("sk_test_x", "whsec_x");
    // swap the SDK for a recorder — the test asserts the params we hand Stripe, not Stripe itself
    (fake as unknown as { stripe: unknown }).stripe = {
      checkout: {
        sessions: {
          create: async (params: Record<string, unknown>) => {
            calls.push(params);
            return { url: "https://checkout.stripe.test/cs_1" };
          },
        },
      },
    };
    return { fake, calls };
  }

  const base = {
    accountId: "acc_1",
    stripeCustomerId: null,
    customerEmail: "a@b.co",
    tier: "growth" as const,
    seatAddons: 0,
    linkedinAddons: 0,
    successUrl: "https://app/onboarding?checkout=success",
    cancelUrl: "https://app/onboarding?checkout=cancel",
  };

  it("collects a card and starts a Stripe-side trial when trialPeriodDays is set", async () => {
    const { fake, calls } = capture();
    await fake.createCheckoutSession({ ...base, trialPeriodDays: 3 });
    const sub = calls[0]?.subscription_data as Record<string, unknown>;
    expect(calls[0]?.payment_method_collection).toBe("always");
    expect(sub.trial_period_days).toBe(3);
    expect(sub.metadata).toEqual({ accountId: "acc_1" });
    // the session id rides the success URL so the return can be confirmed without a webhook
    expect(calls[0]?.success_url).toBe(base.successUrl + "&session_id={CHECKOUT_SESSION_ID}");
  });

  it("omits the trial entirely when trialPeriodDays is absent (immediate charge)", async () => {
    const { fake, calls } = capture();
    await fake.createCheckoutSession(base);
    const sub = calls[0]?.subscription_data as Record<string, unknown>;
    expect("trial_period_days" in sub).toBe(false);
  });

  it("appends the session-id template once, with the right separator", async () => {
    const { fake, calls } = capture();
    await fake.createCheckoutSession({ ...base, successUrl: "https://app/done" });
    expect(calls[0]?.success_url).toBe("https://app/done?session_id={CHECKOUT_SESSION_ID}");
    await fake.createCheckoutSession({
      ...base,
      successUrl: "https://app/done?session_id={CHECKOUT_SESSION_ID}",
    });
    expect(calls[1]?.success_url).toBe("https://app/done?session_id={CHECKOUT_SESSION_ID}");
  });
});
