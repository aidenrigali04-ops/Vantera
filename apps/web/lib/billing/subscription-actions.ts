'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { completeOnboardingWithPlan } from '@/app/(admin)/admin/onboarding/actions'
import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import type { OnboardingPlanId } from '@/lib/onboarding/pricing-plans'
import { getPaidPlanPaymentLink } from '@/lib/onboarding/pricing-plans'
import {
  createBillingPortalSession,
  retrieveCheckoutSession,
  resolvePlanIdFromCheckout,
  type CheckoutContext,
} from '@/lib/stripe/subscription-checkout'
import {
  applyStripeBillingToAccount,
  customerIdFromStripe,
} from '@/lib/stripe/sync-account-billing'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const startCheckoutSchema = z.object({
  planId: z.enum(['team', 'enterprise']),
  context: z.enum(['onboarding', 'billing']),
})

export async function startPlanCheckoutAction(
  input: z.infer<typeof startCheckoutSchema>,
): Promise<ActionResult<{ url: string }>> {
  const parsed = startCheckoutSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: 'Invalid plan selection' }
  }

  return {
    success: true,
    data: { url: getPaidPlanPaymentLink(parsed.data.planId) },
  }
}

export async function openBillingPortalAction(): Promise<ActionResult<{ url: string }>> {
  const session = await requireAdminSession()

  try {
    const [account] = await db
      .select({ stripeCustomerId: accounts.stripeCustomerId })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1)

    const customerId = account?.stripeCustomerId ?? null

    if (!customerId) {
      return {
        success: false,
        error: 'No active subscription found. Upgrade to Team to create a billing profile.',
      }
    }

    const url = await createBillingPortalSession(customerId)
    return { success: true, data: { url } }
  } catch (err) {
    console.error('[openBillingPortalAction]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not open billing portal',
    }
  }
}

/** After Stripe Checkout redirect — verifies payment and applies plan. */
export async function finalizeCheckoutSessionAction(
  sessionId: string,
): Promise<ActionResult<{ redirectTo: string; planId: OnboardingPlanId }>> {
  const session = await requireAdminSession()

  try {
    const checkout = await retrieveCheckoutSession(sessionId)

    const paid =
      checkout.payment_status === 'paid' || checkout.payment_status === 'no_payment_required'
    if (checkout.status !== 'complete' || !paid) {
      return { success: false, error: 'Checkout is not complete yet. Refresh in a moment.' }
    }

    const accountId = checkout.metadata?.account_id
    if (!accountId || accountId !== session.accountId) {
      return { success: false, error: 'Checkout session does not match your workspace.' }
    }

    const planId = resolvePlanIdFromCheckout(checkout)
    if (!planId || planId === 'free') {
      return { success: false, error: 'Could not determine plan from checkout.' }
    }

    const customerId = customerIdFromStripe(checkout.customer)
    const subscriptionId =
      typeof checkout.subscription === 'string'
        ? checkout.subscription
        : checkout.subscription?.id ?? null

    const applied = await applyStripeBillingToAccount({
      accountId: session.accountId,
      planId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    })

    if (!applied.ok) {
      return { success: false, error: applied.message }
    }

    const context = checkout.metadata?.context as CheckoutContext | undefined

    if (context === 'onboarding') {
      const completed = await completeOnboardingWithPlan(session.accountId, planId)
      if (!completed.success) {
        return { success: false, error: completed.error }
      }
      revalidatePath('/admin', 'layout')
      return {
        success: true,
        data: { redirectTo: completed.data.redirectTo, planId },
      }
    }

    revalidatePath('/admin/billing')
    revalidatePath('/admin/settings')
    return {
      success: true,
      data: { redirectTo: '/admin/billing', planId },
    }
  } catch (err) {
    console.error('[finalizeCheckoutSessionAction]', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Could not verify checkout',
    }
  }
}
