import { describe, expect, it } from "vitest";
import type { CheckoutSessionResult, SubscriptionUpdate } from "@vantera/billing";
import { decideCheckoutConfirmation } from "./confirm-checkout";

const ACCOUNT = "acct-1";

const subscription: SubscriptionUpdate = {
  type: "subscription_updated",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  accountId: ACCOUNT,
  status: "trialing",
  planPriceId: null,
  seatsPurchased: 0,
  linkedinAccountsPurchased: 0,
  currentPeriodEnd: null,
};

const session = (over: Partial<CheckoutSessionResult> = {}): CheckoutSessionResult => ({
  accountId: ACCOUNT,
  complete: true,
  subscription,
  ...over,
});

describe("decideCheckoutConfirmation", () => {
  it("applies a completed session belonging to this workspace", () => {
    const d = decideCheckoutConfirmation(session(), ACCOUNT);
    expect(d.apply).toBe(true);
    if (d.apply) {
      expect(d.snapshot.stripeSubscriptionId).toBe("sub_1");
      // a trial is an active entitlement — the flow must finish, not bounce back to pay
      expect(d.snapshot.subscriptionStatus).toBe("trialing");
    }
  });

  it("REFUSES a session opened for a different workspace", () => {
    const d = decideCheckoutConfirmation(session({ accountId: "acct-other" }), ACCOUNT);
    expect(d).toEqual({ apply: false, reason: "wrong-account" });
  });

  it("refuses a session with no tenant attribution at all", () => {
    const d = decideCheckoutConfirmation(session({ accountId: null }), ACCOUNT);
    expect(d).toEqual({ apply: false, reason: "wrong-account" });
  });

  it("refuses a session the customer hasn't finished", () => {
    expect(decideCheckoutConfirmation(session({ complete: false }), ACCOUNT)).toEqual({
      apply: false,
      reason: "not-complete",
    });
  });

  it("refuses an unknown session id", () => {
    expect(decideCheckoutConfirmation(null, ACCOUNT)).toEqual({
      apply: false,
      reason: "unknown-session",
    });
  });

  it("refuses a completed session that carries no subscription", () => {
    expect(decideCheckoutConfirmation(session({ subscription: null }), ACCOUNT)).toEqual({
      apply: false,
      reason: "no-subscription",
    });
  });
});
