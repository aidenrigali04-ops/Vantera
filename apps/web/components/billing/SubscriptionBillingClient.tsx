'use client'

import { PlanUpgradeButtons } from '@/components/billing/PlanUpgradeButtons'
import { PageHeader } from '@/components/operational/PageHeader'
import { Button } from '@/components/ui/button'
import { finalizeCheckoutSessionAction, openBillingPortalAction } from '@/lib/billing/subscription-actions'
import {
  ONBOARDING_PRICING_PLANS,
  type PaidPlanId,
} from '@/lib/onboarding/pricing-plans'
import { openStripePaymentLink } from '@/lib/stripe/open-payment-link'
import { cn } from '@/lib/utils'
import { Check, CreditCard, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'

type Props = {
  currentPlan: string
  hasStripeCustomer: boolean
}

export function SubscriptionBillingClient({ currentPlan, hasStripeCustomer }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [finalizing, setFinalizing] = useState(false)

  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    if (checkout !== 'success' || !sessionId || finalizing) return

    setFinalizing(true)
    startTransition(async () => {
      const result = await finalizeCheckoutSessionAction(sessionId)
      if (!result.success) {
        toast.error(result.error)
        setFinalizing(false)
        router.replace('/admin/billing')
        return
      }
      toast.success('Your plan is updated')
      router.replace(result.data.redirectTo)
    })
  }, [searchParams, router, finalizing])

  function handleManageBilling() {
    startTransition(async () => {
      const result = await openBillingPortalAction()
      if (!result.success) {
        toast.error(result.error)
        return
      }
      window.location.href = result.data.url
    })
  }

  function handleUpgrade(planId: PaidPlanId) {
    openStripePaymentLink(planId)
  }

  const displayPlan =
    currentPlan === 'enterprise' ? 'Enterprise' : currentPlan === 'team' ? 'Team' : 'Free'

  const isFree = displayPlan === 'Free'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-5 md:px-8 md:py-6">
      <PageHeader
        title="Plan & billing"
        description="Upgrade your workspace for more SDR credits, live discovery, and automations. All plans bill monthly through Stripe."
      />

      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Current plan
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {displayPlan}
        </p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {hasStripeCustomer
            ? 'Billing is managed through Stripe. Use the portal to update your card, download invoices, or cancel.'
            : isFree
              ? 'You are on the free workspace. Upgrade below for more outreach credits and SDR agents.'
              : 'Your subscription is active. Manage payment details in Stripe if needed.'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {isFree ? (
            <PlanUpgradeButtons layout="row" />
          ) : displayPlan === 'Team' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleUpgrade('enterprise')}
              className="border-[var(--border-default)]"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Upgrade to Enterprise — $449/mo
            </Button>
          ) : null}

          {hasStripeCustomer ? (
            <Button type="button" variant="outline" disabled={isPending} onClick={handleManageBilling}>
              Manage in Stripe
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Choose a plan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ONBOARDING_PRICING_PLANS.map((plan) => {
            const active =
              (plan.id === 'free' && displayPlan === 'Free') ||
              (plan.id === 'team' && displayPlan === 'Team') ||
              (plan.id === 'enterprise' && displayPlan === 'Enterprise')

            const canUpgrade =
              (plan.id === 'team' && displayPlan !== 'Team' && displayPlan !== 'Enterprise') ||
              (plan.id === 'enterprise' && displayPlan !== 'Enterprise')

            return (
              <article
                key={plan.id}
                className={cn(
                  'flex h-full flex-col rounded-xl border p-4',
                  active
                    ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
                  plan.highlighted && !active && 'ring-1 ring-[var(--brand-accent-border)]/40',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{plan.name}</p>
                  {active ? (
                    <span className="rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)]">
                      Current
                    </span>
                  ) : null}
                  {plan.highlighted && !active ? (
                    <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {plan.price}
                  <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">
                    {plan.period}
                  </span>
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {plan.description}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]"
                    >
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brand-accent)]" />
                      {f}
                    </li>
                  ))}
                </ul>
                {canUpgrade && plan.stripePaymentLink ? (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-4 w-full bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
                    onClick={() => handleUpgrade(plan.id as PaidPlanId)}
                  >
                    Upgrade to {plan.name}
                  </Button>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <p className="text-xs text-[var(--text-tertiary)]">
        Questions about billing?{' '}
        <a href="mailto:sales@vanterasystem.dev" className="text-[var(--brand-accent)] hover:underline">
          Contact support
        </a>{' '}
        or visit{' '}
        <Link href="/admin/settings" className="text-[var(--brand-accent)] hover:underline">
          settings
        </Link>
        .
      </p>
    </div>
  )
}
