import { patchAccountRow } from '@/lib/onboarding/account-store'
import {
  planIdFromStripePriceId,
  toAccountPlanEnum,
  type BillablePlanId,
} from '@/lib/stripe/subscription-config'
import type { OnboardingPlanId } from '@/lib/onboarding/pricing-plans'
import type Stripe from 'stripe'

export async function applyStripeBillingToAccount(params: {
  accountId: string
  planId: OnboardingPlanId
  stripeCustomerId: string | null
  stripeSubscriptionId?: string | null
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: Record<string, string | null> = {
    plan: toAccountPlanEnum(params.planId),
  }

  if (params.stripeCustomerId) {
    patch.stripe_customer_id = params.stripeCustomerId
  }

  if (params.stripeSubscriptionId) {
    patch.stripe_subscription_id = params.stripeSubscriptionId
  }

  const saved = await patchAccountRow(params.accountId, patch)
  if (!saved.ok) {
    return saved
  }

  return { ok: true }
}

export function planIdFromSubscription(subscription: Stripe.Subscription): BillablePlanId | null {
  // Scan every item — a subscription may carry a seat add-on alongside the
  // plan, in any order, so we match by known plan price IDs rather than [0].
  for (const item of subscription.items.data) {
    const priceId = item?.price?.id
    if (!priceId) continue
    const planId = planIdFromStripePriceId(priceId)
    if (planId) return planId
  }
  return null
}

export function customerIdFromStripe(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  if ('deleted' in customer && customer.deleted) return null
  return customer.id
}
