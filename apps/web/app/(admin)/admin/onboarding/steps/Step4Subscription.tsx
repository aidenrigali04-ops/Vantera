'use client'

import { completeOnboardingWithPlan } from '@/app/(admin)/admin/onboarding/actions'
import {
  ONBOARDING_PRICING_PLANS,
  planRequiresPayment,
  type OnboardingPlanId,
} from '@/lib/onboarding/pricing-plans'
import { openStripePaymentLink } from '@/lib/stripe/open-payment-link'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import {
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

type Props = {
  accountId: string
  onComplete: () => void
}

export function Step4Subscription({ accountId, onComplete }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlanId>('free')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (): Promise<boolean> => {
    setError(null)
    setSubmitting(true)

    try {
      const result = await runStepAction(() =>
        completeOnboardingWithPlan(accountId, selectedPlan),
      )

      if (result == null) {
        setError('The server did not respond. Refresh the page and try again.')
        return false
      }

      if (result.success !== true) {
        setError(('error' in result && result.error) || 'Could not finish setup. Try again.')
        return false
      }

      if (planRequiresPayment(selectedPlan)) {
        // Advance localStorage past subscription so wizard resumes at step 5 (team) after Stripe
        try {
          const storageKey = `vantera_onboarding_step_${accountId}`
          const raw = window.localStorage.getItem(storageKey)
          const stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
          window.localStorage.setItem(storageKey, JSON.stringify({ ...stored, step: 5 }))
        } catch {
          /* ignore */
        }
        openStripePaymentLink(selectedPlan)
        return false
      }

      onComplete()
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSubmitting(false)
    }
  }, [accountId, onComplete, selectedPlan])

  const selectedPlanMeta = ONBOARDING_PRICING_PLANS.find((plan) => plan.id === selectedPlan)

  useRegisterOnboardingStep({
    canAdvance: Boolean(selectedPlan),
    isSubmitting: submitting,
    submit,
    primaryLabel:
      selectedPlan === 'free'
        ? 'Start free'
        : selectedPlan === 'enterprise'
          ? `Subscribe — ${selectedPlanMeta?.price ?? '$449'}/mo`
          : `Subscribe — ${selectedPlanMeta?.price ?? '$79'}/mo`,
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {ONBOARDING_PRICING_PLANS.map((plan) => {
          const active = selectedPlan === plan.id
          return (
            <motion.button
              key={plan.id}
              type="button"
              variants={fadeUp}
              onClick={() => !submitting && setSelectedPlan(plan.id)}
              disabled={submitting}
              className={cn(
                'relative flex flex-col rounded-lg border p-3 text-left transition-colors duration-[120ms]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                submitting ? 'pointer-events-none opacity-60' : '',
                active
                  ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                plan.highlighted && !active && 'ring-1 ring-[var(--border-strong)]',
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-2 right-2 rounded-full bg-[var(--highlight)] px-2 py-0.5 text-[10px] font-semibold text-[#1d1d1f]">
                  Popular
                </span>
              ) : null}
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{plan.name}</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                {plan.price}
                <span className="ml-1 text-[11px] font-normal text-[var(--text-tertiary)]">
                  {plan.period}
                </span>
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                {plan.description}
              </p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-1.5 text-[11px] text-[var(--text-secondary)]"
                  >
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </motion.button>
          )
        })}
      </div>

      {selectedPlanMeta ? (
        <motion.p variants={fadeUp} className="text-[12px] text-[var(--text-tertiary)]">
          {planRequiresPayment(selectedPlan)
            ? `${selectedPlanMeta.name} is billed monthly through Stripe (${selectedPlanMeta.price}${selectedPlanMeta.period}). You will complete payment on the next screen, then return to your workspace.`
            : 'No credit card required. Upgrade anytime from Plan & billing.'}
        </motion.p>
      ) : null}

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
