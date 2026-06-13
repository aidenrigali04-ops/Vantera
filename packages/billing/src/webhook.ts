import { planForPriceId, type PlanTier } from "./plans";
import type { SubscriptionStatus } from "./entitlements";
import type { ParsedWebhookEvent } from "./types";

export interface PersistedSnapshot {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: PlanTier | "none";
  subscriptionStatus: SubscriptionStatus;
  seatsPurchased: number;
  linkedinAccountsPurchased: number;
  currentPeriodEnd: string | null;
}

/** Pure: translate a verified event into the columns to write, or null to skip. */
export function snapshotFromEvent(event: ParsedWebhookEvent): PersistedSnapshot | null {
  if (event.type === "ignored") return null;

  if (event.type === "subscription_canceled") {
    return {
      stripeCustomerId: event.stripeCustomerId,
      stripeSubscriptionId: event.stripeSubscriptionId,
      plan: "none",
      subscriptionStatus: "canceled",
      seatsPurchased: 0,
      linkedinAccountsPurchased: 0,
      currentPeriodEnd: null,
    };
  }

  const tier = event.planPriceId ? planForPriceId(event.planPriceId) : null;
  return {
    stripeCustomerId: event.stripeCustomerId,
    stripeSubscriptionId: event.stripeSubscriptionId,
    plan: tier ?? "none",
    subscriptionStatus: event.status,
    seatsPurchased: event.seatsPurchased,
    linkedinAccountsPurchased: event.linkedinAccountsPurchased,
    currentPeriodEnd: event.currentPeriodEnd,
  };
}
