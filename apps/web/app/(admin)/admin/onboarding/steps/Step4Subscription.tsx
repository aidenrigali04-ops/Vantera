'use client'

import {
  ONBOARDING_PRICING_PLANS,
  type OnboardingPlanId,
} from '@/lib/onboarding/pricing-plans'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { completeOnboardingWithPlan } from '../actions'
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
          ? 'Contact sales'
          : 'Start Team plan',
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
              onClick={() => setSelectedPlan(plan.id)}
              className={cn(
                'relative flex flex-col rounded-lg border p-3 text-left transition-colors duration-[120ms]',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                active
                  ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                plan.highlighted && !active && 'ring-1 ring-[var(--accent-border)]/40',
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-2 right-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-primary)]">
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
          {selectedPlan === 'enterprise'
            ? 'We’ll reach out to tailor Enterprise — you can explore the product now.'
            : 'No credit card required to start. Upgrade anytime from settings.'}
        </motion.p>
      ) : null}

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
