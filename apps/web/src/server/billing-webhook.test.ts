import { describe, expect, it, vi } from "vitest";
import { handleStripeWebhook } from "./billing-webhook";
import { InMemoryBilling, PLANS } from "@vantera/billing";

function makeDeps(overrides: Partial<any> = {}) {
  const updates: any[] = [];
  return {
    updates,
    deps: {
      provider: new InMemoryBilling("whsec_test"),
      recordEvent: vi.fn(async () => true), // true = new, false = duplicate
      applySnapshot: vi.fn(async (snap: any) => {
        updates.push(snap);
      }),
      ...overrides,
    },
  };
}

const activeBody = JSON.stringify({
  id: "evt_1",
  type: "subscription_updated",
  customer: "cus_1",
  subscription: "sub_1",
  status: "active",
  planPriceId: PLANS.growth.stripePriceId,
  seats: 0,
  linkedin: 0,
  currentPeriodEnd: "2026-07-13T00:00:00.000Z",
});

describe("handleStripeWebhook", () => {
  it("rejects a bad signature with 401 and writes nothing", async () => {
    const { deps, updates } = makeDeps();
    const res = await handleStripeWebhook(activeBody, "wrong-sig", deps);
    expect(res.status).toBe(401);
    expect(updates).toHaveLength(0);
  });

  it("persists the snapshot for an active subscription (200)", async () => {
    const { deps, updates } = makeDeps();
    const res = await handleStripeWebhook(activeBody, "whsec_test", deps);
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ plan: "growth", subscriptionStatus: "active", outreachPaused: false });
  });

  it("no-ops on a duplicate event", async () => {
    const { deps, updates } = makeDeps({ recordEvent: vi.fn(async () => false) });
    const res = await handleStripeWebhook(activeBody, "whsec_test", deps);
    expect(res.status).toBe(200);
    expect(updates).toHaveLength(0);
  });

  it("pauses outreach when the subscription lapses", async () => {
    const { deps, updates } = makeDeps();
    const body = JSON.stringify({ id: "evt_2", type: "subscription_canceled", customer: "cus_1", subscription: "sub_1" });
    await handleStripeWebhook(body, "whsec_test", deps);
    expect(updates[0]).toMatchObject({ subscriptionStatus: "canceled", outreachPaused: true });
  });

  it("threads accountId through for first-subscription linkage", async () => {
    const { deps, updates } = makeDeps();
    const body = JSON.stringify({
      id: "evt_3",
      type: "subscription_updated",
      customer: "cus_new",
      subscription: "sub_new",
      status: "active",
      planPriceId: PLANS.growth.stripePriceId,
      seats: 0,
      linkedin: 0,
      currentPeriodEnd: "2026-07-13T00:00:00.000Z",
      accountId: "acc_xyz",
    });
    const res = await handleStripeWebhook(body, "whsec_test", deps);
    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ accountId: "acc_xyz" });
  });
});
