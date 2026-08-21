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
  /**
   * Card-required trial: Stripe collects a payment method at checkout and starts
   * the subscription in `trialing` for this many days before the first charge.
   * Omit for an immediate charge (plan switches, lapsed accounts re-subscribing).
   */
  trialPeriodDays?: number;
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

/** The subscription half of a parsed event, reused when confirming a checkout return. */
export type SubscriptionUpdate = Extract<ParsedWebhookEvent, { type: "subscription_updated" }>;

/**
 * A completed checkout, read back straight from the provider. The success redirect is a
 * confirmation signal in its own right: relying only on the webhook leaves the user staring
 * at a spinner whenever the webhook is delayed, undelivered, or (in local development)
 * unreachable. `accountId` is the tenant the session was opened for — the caller MUST check
 * it against the session's own account before applying anything.
 */
export interface CheckoutSessionResult {
  accountId: string | null;
  /** Provider considers the session finished (paid, or $0 because a trial started). */
  complete: boolean;
  subscription: SubscriptionUpdate | null;
}

export interface BillingProvider {
  createCheckoutSession(req: CheckoutRequest): Promise<SessionResult>;
  createPortalSession(req: PortalRequest): Promise<SessionResult>;
  /** Throw if the signature is invalid; otherwise return the raw provider event. */
  verifyWebhook(rawBody: string, signature: string): unknown;
  /** Pull the provider event id used for idempotency. */
  webhookEventId(rawEvent: unknown): string | null;
  /** Map a verified raw event to the vendor-neutral shape. */
  parseWebhook(rawEvent: unknown): ParsedWebhookEvent;
  /**
   * Read a checkout session back by id (the `session_id` on the success redirect), so a
   * return can be confirmed without waiting for the webhook. Returns null when the id is
   * unknown to the provider.
   */
  retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult | null>;
}
