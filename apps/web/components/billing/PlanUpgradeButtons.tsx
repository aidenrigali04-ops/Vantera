'use client'

import { Button } from '@/components/ui/button'
import { ONBOARDING_PRICING_PLANS, type PaidPlanId } from '@/lib/onboarding/pricing-plans'
import { openStripePaymentLink } from '@/lib/stripe/open-payment-link'
import { cn } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'

type Props = {
  layout?: 'stack' | 'row'
  className?: string
  onNavigate?: () => void
}

export function PlanUpgradeButtons({ layout = 'stack', className, onNavigate }: Props) {
  const team = ONBOARDING_PRICING_PLANS.find((plan) => plan.id === 'team')
  const enterprise = ONBOARDING_PRICING_PLANS.find((plan) => plan.id === 'enterprise')

  function handleUpgrade(planId: PaidPlanId) {
    onNavigate?.()
    openStripePaymentLink(planId)
  }

  return (
    <div
      className={cn(
        layout === 'row' ? 'flex flex-col gap-2 sm:flex-row' : 'flex flex-col gap-2',
        className,
      )}
    >
      {team ? (
        <Button
          type="button"
          className="w-full bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
          onClick={() => handleUpgrade('team')}
        >
          Upgrade to Team — {team.price}
          {team.period}
          <ArrowUpRight className="ml-1.5 h-4 w-4" />
        </Button>
      ) : null}
      {enterprise ? (
        <Button
          type="button"
          variant="outline"
          className="w-full border-[var(--border-default)]"
          onClick={() => handleUpgrade('enterprise')}
        >
          Upgrade to Enterprise — {enterprise.price}
          {enterprise.period}
          <ArrowUpRight className="ml-1.5 h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
