import type {
  BillingProvider,
  CheckoutRequest,
  ParsedWebhookEvent,
  PortalRequest,
  SessionResult,
} from "./types";
import type { SubscriptionStatus } from "./entitlements";

/** Test/dev double. Mirrors StripeBilling's behavior contract.
 *  Uses plain signature equality; the real adapter uses Stripe's HMAC verification.
 */
export class InMemoryBilling implements BillingProvider {
  readonly checkouts: CheckoutRequest[] = [];
  constructor(private readonly webhookSecret = "in-memory-whsec") {}

  async createCheckoutSession(req: CheckoutRequest): Promise<SessionResult> {
    this.checkouts.push(req);
    return { url: `https://checkout.test/${req.tier}?account=${req.accountId}` };
  }

  async createPortalSession(req: PortalRequest): Promise<SessionResult> {
    return { url: `https://portal.test/${req.stripeCustomerId}` };
  }

  // fake: plain equality; the real adapter uses Stripe's HMAC verification
  verifyWebhook(rawBody: string, signature: string): unknown {
    if (signature !== this.webhookSecret) throw new Error("invalid signature");
    return JSON.parse(rawBody);
  }

  webhookEventId(rawEvent: unknown): string | null {
    const e = rawEvent as Record<string, unknown>;
    return typeof e?.id === "string" ? e.id : null;
  }

  parseWebhook(rawEvent: unknown): ParsedWebhookEvent {
    const e = rawEvent as Record<string, unknown>;
    if (e?.type === "subscription_canceled") {
      return {
        type: "subscription_canceled",
        stripeCustomerId: String(e.customer),
        stripeSubscriptionId: String(e.subscription),
      };
    }
    if (e?.type === "subscription_updated") {
      return {
        type: "subscription_updated",
        stripeCustomerId: String(e.customer),
        stripeSubscriptionId: String(e.subscription),
        accountId: (e.accountId as string) ?? null,
        status: e.status as SubscriptionStatus,
        planPriceId: (e.planPriceId as string) ?? null,
        seatsPurchased: Number(e.seats ?? 0),
        linkedinAccountsPurchased: Number(e.linkedin ?? 0),
        currentPeriodEnd: (e.currentPeriodEnd as string) ?? null,
      };
    }
    return { type: "ignored" };
  }
}
