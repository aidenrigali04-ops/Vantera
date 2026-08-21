import Stripe from "stripe";
import { ADDON_PRICES, PLAN_PRICE_IDS, priceIdFor } from "./plans";
import type { SubscriptionStatus } from "./entitlements";
import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutSessionResult,
  ParsedWebhookEvent,
  PortalRequest,
  SessionResult,
  SubscriptionUpdate,
} from "./types";

const STATUS_MAP: Record<string, SubscriptionStatus> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete_expired: "canceled",
};

export class StripeBilling implements BillingProvider {
  private readonly stripe: Stripe;
  constructor(secretKey: string, private readonly webhookSecret: string) {
    this.stripe = new Stripe(secretKey);
  }

  async createCheckoutSession(req: CheckoutRequest): Promise<SessionResult> {
    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: priceIdFor(req.tier, req.interval ?? "month"), quantity: 1 },
    ];
    if (req.seatAddons > 0) line_items.push({ price: ADDON_PRICES.seat, quantity: req.seatAddons });
    if (req.linkedinAddons > 0)
      line_items.push({ price: ADDON_PRICES.linkedinAccount, quantity: req.linkedinAddons });

    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      customer: req.stripeCustomerId ?? undefined,
      customer_email: req.stripeCustomerId ? undefined : req.customerEmail,
      client_reference_id: req.accountId,
      success_url: withSessionId(req.successUrl),
      cancel_url: req.cancelUrl,
      // "card required, trial after": the payment method is always collected, even when
      // the trial makes the first invoice $0 — so the trial can convert without a second visit.
      payment_method_collection: "always",
      subscription_data: {
        metadata: { accountId: req.accountId },
        ...(req.trialPeriodDays && req.trialPeriodDays > 0
          ? { trial_period_days: req.trialPeriodDays }
          : {}),
      },
    });
    if (!session.url) throw new Error("stripe checkout: no url");
    return { url: session.url };
  }

  async createPortalSession(req: PortalRequest): Promise<SessionResult> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: req.stripeCustomerId,
      return_url: req.returnUrl,
    });
    return { url: session.url };
  }

  verifyWebhook(rawBody: string, signature: string): unknown {
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }

  webhookEventId(rawEvent: unknown): string | null {
    const e = rawEvent as { id?: string };
    return typeof e.id === "string" ? e.id : null;
  }

  parseWebhook(rawEvent: unknown): ParsedWebhookEvent {
    const event = rawEvent as Stripe.Event;
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      return {
        type: "subscription_canceled",
        stripeCustomerId: String(sub.customer),
        stripeSubscriptionId: sub.id,
      };
    }
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated"
    ) {
      return mapSubscription(event.data.object as Stripe.Subscription);
    }
    return { type: "ignored" };
  }

  async retrieveCheckoutSession(sessionId: string): Promise<CheckoutSessionResult | null> {
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
    } catch {
      return null; // unknown / malformed id — the caller treats this as "not confirmed"
    }
    const sub = session.subscription;
    return {
      accountId: session.client_reference_id ?? null,
      // A trialing subscription is $0 today, so payment_status stays "no_payment_required";
      // session.status === "complete" is the signal that the customer finished.
      complete: session.status === "complete",
      subscription: sub && typeof sub !== "string" ? mapSubscription(sub) : null,
    };
  }
}

/**
 * Append Stripe's `{CHECKOUT_SESSION_ID}` template to the success URL (Stripe substitutes the
 * real id on redirect) so the return can be verified without waiting for the webhook.
 */
function withSessionId(successUrl: string): string {
  if (successUrl.includes("{CHECKOUT_SESSION_ID}")) return successUrl;
  return successUrl + (successUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}";
}

/** Stripe subscription → the vendor-neutral update shape (shared by webhook + checkout return). */
function mapSubscription(sub: Stripe.Subscription): SubscriptionUpdate {
  const items = sub.items.data;
  const planItem = items.find((i) => PLAN_PRICE_IDS.has(i.price.id));
  const seatItem = items.find((i) => i.price.id === ADDON_PRICES.seat);
  const liItem = items.find((i) => i.price.id === ADDON_PRICES.linkedinAccount);
  // In Stripe API 18.x, current_period_end lives on SubscriptionItem, not Subscription.
  // We read it from the plan-tier item which has the billing period anchor.
  const periodEnd = planItem?.current_period_end;
  return {
    type: "subscription_updated",
    stripeCustomerId: String(sub.customer),
    stripeSubscriptionId: sub.id,
    accountId: (sub.metadata?.accountId as string | undefined) ?? null,
    status: STATUS_MAP[sub.status] ?? "canceled",
    planPriceId: planItem?.price.id ?? null,
    seatsPurchased: seatItem?.quantity ?? 0,
    linkedinAccountsPurchased: liItem?.quantity ?? 0,
    currentPeriodEnd: periodEnd != null ? new Date(periodEnd * 1000).toISOString() : null,
  };
}

export function createBillingFromEnv(): BillingProvider {
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec) throw new Error("Stripe env not configured (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET)");
  return new StripeBilling(key, whsec);
}
