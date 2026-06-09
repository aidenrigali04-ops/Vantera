'use client'

import { IconTile } from '@/components/shared/IconTile'
import { PlanUpgradeButtons } from '@/components/billing/PlanUpgradeButtons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  formatSdrCredits,
  SDR_LEAD_PULL_COST,
  SDR_MONTHLY_ALLOWANCE,
  SDR_OUTREACH_SEND_COST,
  SDR_TRIAL_DAYS,
  type SdrCreditStatus,
} from '@/lib/sdr/credit-types'
import { ONBOARDING_PRICING_PLANS } from '@/lib/onboarding/pricing-plans'
import { Check, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  credits: SdrCreditStatus | undefined
  onStartTrial: () => Promise<SdrCreditStatus>
}

export function SdrCreditPaywall({ open, onOpenChange, credits, onStartTrial }: Props) {
  const [starting, setStarting] = useState(false)
  const trialUsed = Boolean(credits?.trialEndsAt && !credits.trialActive)

  async function handleTrial() {
    setStarting(true)
    try {
      await onStartTrial()
      toast.success(`${SDR_TRIAL_DAYS}-day Standard trial activated — outreach credits refreshed`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start trial')
    } finally {
      setStarting(false)
    }
  }

  const teamPlan = ONBOARDING_PRICING_PLANS.find((plan) => plan.id === 'team')
  const enterprisePlan = ONBOARDING_PRICING_PLANS.find((plan) => plan.id === 'enterprise')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-[var(--border-default)] bg-[var(--bg-surface)] p-0 sm:rounded-xl">
        <div className="border-b border-[var(--border-subtle)] bg-gradient-to-br from-[var(--accent-muted)] via-[var(--bg-surface)] to-[var(--bg-subtle)] px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
              <Zap className="h-3 w-3" />
              SDR outreach credits
            </p>
            <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Upgrade for more credits
            </DialogTitle>
            <DialogDescription className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
              You&apos;ve hit your monthly limit. Lead pulls cost{' '}
              {formatSdrCredits(SDR_LEAD_PULL_COST)} credits each; email, SMS, and LinkedIn sends
              cost {formatSdrCredits(SDR_OUTREACH_SEND_COST)} each. Choose a plan to keep outreach
              running.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {credits && !credits.unlimited ? (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                This period
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
                {formatSdrCredits(credits.used)} / {formatSdrCredits(credits.limit ?? 0)} credits
                used
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                Resets{' '}
                {new Date(credits.periodResetsAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          ) : null}

          <PlanUpgradeButtons onNavigate={() => onOpenChange(false)} />

          {!trialUsed ? (
            <div className="rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)]/40 p-4">
              <div className="flex items-start gap-3">
                <IconTile icon={Sparkles} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Or start a {SDR_TRIAL_DAYS}-day free trial
                  </p>
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                    Try {formatSdrCredits(SDR_MONTHLY_ALLOWANCE.standard ?? 0)} credits/month on
                    Standard tier — no card required.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 w-full border-[var(--border-default)]"
                    disabled={starting}
                    onClick={handleTrial}
                  >
                    {starting ? 'Starting trial…' : `Start ${SDR_TRIAL_DAYS}-day free trial`}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--border-default)] p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">What you get</p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                Team — {teamPlan?.price ?? '$79'}
                {teamPlan?.period ?? '/ mo'} ·{' '}
                {formatSdrCredits(SDR_MONTHLY_ALLOWANCE.standard ?? 0)} credits/mo
              </li>
              <li className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                Enterprise — {enterprisePlan?.price ?? '$449'}
                {enterprisePlan?.period ?? '/ mo'} · unlimited credits
              </li>
              <li className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <Check className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
                {formatSdrCredits(SDR_LEAD_PULL_COST)} per lead ·{' '}
                {formatSdrCredits(SDR_OUTREACH_SEND_COST)} per send
              </li>
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-3 w-full text-[var(--text-secondary)]">
              <Link href="/admin/billing">Compare all plans</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
