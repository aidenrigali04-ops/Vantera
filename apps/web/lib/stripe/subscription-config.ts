import { env } from '@/lib/env'
import type { OnboardingPlanId } from '@/lib/onboarding/pricing-plans'
import { resolveAccountPlan } from '@/lib/onboarding/pricing-plans'

export type BillablePlanId = 'team' | 'enterprise'

/** Plans that require Stripe payment before activation. */
export function planRequiresCheckout(planId: OnboardingPlanId): boolean {
  return planId === 'team' || planId === 'enterprise'
}

export function getStripePriceId(planId: BillablePlanId): string | null {
  if (planId === 'team') {
    const id = env.STRIPE_PRICE_TEAM_MONTHLY?.trim()
    return id || null
  }
  if (planId === 'enterprise') {
    const id = env.STRIPE_PRICE_ENTERPRISE_MONTHLY?.trim()
    return id || null
  }
  return null
}

export function planIdFromStripePriceId(priceId: string): BillablePlanId | null {
  const team = env.STRIPE_PRICE_TEAM_MONTHLY?.trim()
  const enterprise = env.STRIPE_PRICE_ENTERPRISE_MONTHLY?.trim()
  if (team && priceId === team) return 'team'
  if (enterprise && priceId === enterprise) return 'enterprise'
  return null
}

export function toAccountPlanEnum(planId: OnboardingPlanId): 'team' | 'enterprise' {
  return resolveAccountPlan(planId)
}
