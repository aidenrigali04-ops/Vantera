import Stripe from "stripe";
import { ADDON_PRICES, PLANS } from "./plans";
import type { SubscriptionStatus } from "./entitlements";
import type {
  BillingProvider,
  CheckoutRequest,
  ParsedWebhookEvent,
  PortalRequest,
  SessionResult,
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
      { price: PLANS[req.tier].stripePriceId, quantity: 1 },
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
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      subscription_data: { metadata: { accountId: req.accountId } },
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
      const sub = event.data.object as Stripe.Subscription;
      const items = sub.items.data;
      const planItem = items.find((i) => PLANS_PRICE_IDS.has(i.price.id));
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
        currentPeriodEnd: periodEnd != null
          ? new Date(periodEnd * 1000).toISOString()
          : null,
      };
    }
    return { type: "ignored" };
  }
}

const PLANS_PRICE_IDS = new Set(Object.values(PLANS).map((p) => p.stripePriceId));

export function createBillingFromEnv(): BillingProvider {
  const key = process.env.STRIPE_SECRET_KEY;
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whsec) throw new Error("Stripe env not configured (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET)");
  return new StripeBilling(key, whsec);
}
