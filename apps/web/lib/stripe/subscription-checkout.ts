import { env } from '@/lib/env'
import type { OnboardingPlanId } from '@/lib/onboarding/pricing-plans'
import { assertPlatformStripe } from '@/lib/stripe/platform'
import {
  getSeatPriceId,
  getStripePriceId,
  planRequiresCheckout,
  type BillablePlanId,
} from '@/lib/stripe/subscription-config'
import type Stripe from 'stripe'

export type CheckoutContext = 'onboarding' | 'billing'

function appBaseUrl(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
}

export function checkoutSuccessUrl(context: CheckoutContext): string {
  const base = appBaseUrl()
  if (context === 'onboarding') {
    return `${base}/admin/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  }
  return `${base}/admin/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`
}

export function checkoutCancelUrl(context: CheckoutContext): string {
  const base = appBaseUrl()
  if (context === 'onboarding') {
    return `${base}/admin/onboarding?checkout=cancel`
  }
  return `${base}/admin/billing?checkout=cancel`
}

export async function createSubscriptionCheckoutSession(params: {
  accountId: string
  planId: BillablePlanId
  customerEmail: string
  context: CheckoutContext
  /** Existing Stripe customer — used when changing plan. */
  stripeCustomerId?: string | null
  /** Billable seats to bill alongside the base plan (0 = none). */
  seatQuantity?: number
}): Promise<{ url: string; sessionId: string }> {
  const stripe = assertPlatformStripe()
  const priceId = getStripePriceId(params.planId)

  if (!priceId) {
    throw new Error(
      `Stripe price is not configured for the ${params.planId} plan. Set STRIPE_PRICE_${params.planId.toUpperCase()}_MONTHLY in your environment.`,
    )
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceId, quantity: 1 },
  ]

  const seatQuantity = Math.max(0, Math.trunc(params.seatQuantity ?? 0))
  const seatPriceId = getSeatPriceId()
  if (seatQuantity > 0 && seatPriceId) {
    lineItems.push({ price: seatPriceId, quantity: seatQuantity })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.stripeCustomerId ?? undefined,
    customer_email: params.stripeCustomerId ? undefined : params.customerEmail,
    line_items: lineItems,
    allow_promotion_codes: true,
    success_url: checkoutSuccessUrl(params.context),
    cancel_url: checkoutCancelUrl(params.context),
    metadata: {
      account_id: params.accountId,
      plan_id: params.planId,
      context: params.context,
    },
    subscription_data: {
      metadata: {
        account_id: params.accountId,
        plan_id: params.planId,
      },
    },
  })

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL')
  }

  return { url: session.url, sessionId: session.id }
}

export async function createBillingPortalSession(stripeCustomerId: string): Promise<string> {
  const stripe = assertPlatformStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appBaseUrl()}/admin/billing`,
  })
  return session.url
}

export async function retrieveCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session> {
  const stripe = assertPlatformStripe()
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  })
}

export function resolvePlanIdFromCheckout(
  session: Stripe.Checkout.Session,
): OnboardingPlanId | null {
  const meta = session.metadata?.plan_id
  if (meta === 'team' || meta === 'enterprise') return meta
  return null
}

export function requiresCheckoutForSelection(planId: OnboardingPlanId): boolean {
  return planRequiresCheckout(planId)
}
