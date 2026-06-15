import type { PlanTier, BillingInterval } from "./plans";
import type { SubscriptionStatus } from "./entitlements";

export interface CheckoutRequest {
  accountId: string;
  /** Stripe customer id if one already exists; provider creates one otherwise. */
  stripeCustomerId: string | null;
  customerEmail: string;
  tier: PlanTier;
  /** Billing cadence; defaults to monthly when omitted. */
  interval?: BillingInterval;
  /** Extra seats beyond the tier base (quantity line). */
  seatAddons: number;
  /** LinkedIn-account quantity line. */
  linkedinAddons: number;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalRequest {
  stripeCustomerId: string;
  returnUrl: string;
}

export interface SessionResult {
  url: string;
}

/** Vendor-neutral webhook event after verification + parse. */
export type ParsedWebhookEvent =
  | {
      type: "subscription_updated";
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      accountId: string | null;
      status: SubscriptionStatus;
      /** Base-plan price id (maps to a tier via plans.planForPriceId). */
      planPriceId: string | null;
      seatsPurchased: number;
      linkedinAccountsPurchased: number;
      currentPeriodEnd: string | null;
    }
  | { type: "subscription_canceled"; stripeCustomerId: string; stripeSubscriptionId: string }
  | { type: "ignored" };

export interface BillingProvider {
  createCheckoutSession(req: CheckoutRequest): Promise<SessionResult>;
  createPortalSession(req: PortalRequest): Promise<SessionResult>;
  /** Throw if the signature is invalid; otherwise return the raw provider event. */
  verifyWebhook(rawBody: string, signature: string): unknown;
  /** Pull the provider event id used for idempotency. */
  webhookEventId(rawEvent: unknown): string | null;
  /** Map a verified raw event to the vendor-neutral shape. */
  parseWebhook(rawEvent: unknown): ParsedWebhookEvent;
}
