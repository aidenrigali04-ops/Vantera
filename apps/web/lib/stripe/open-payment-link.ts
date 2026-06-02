'use client'

import type { PaidPlanId } from '@/lib/onboarding/pricing-plans'
import { getPaidPlanPaymentLink } from '@/lib/onboarding/pricing-plans'

export function openStripePaymentLink(planId: PaidPlanId): void {
  window.location.href = getPaidPlanPaymentLink(planId)
}
