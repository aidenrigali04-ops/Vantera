'use client'

import type { BusinessAnalysis, PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'
import { motion } from 'framer-motion'
import { Building2, Target, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { fetchPreviewLeadsAction, recordOnboardingStepEvent } from '../actions'
import { StepError, fadeUp, rethrowFrameworkNavigation, runStepAction, stepContainer } from '../_primitives'

type Props = {
  accountId: string
  analysis: BusinessAnalysis | null
  onLeadsReady: (leads: PreviewLead[]) => void
}

function InsightCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-muted)] text-[var(--accent)]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
            {label}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-primary)]">{value}</p>
        </div>
      </div>
    </div>
  )
}

export function Step2AiOverview({ accountId, analysis, onLeadsReady }: Props) {
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (): Promise<boolean> => {
    if (!analysis) return false
    setError(null)
    setFetching(true)
    try {
      void recordOnboardingStepEvent(accountId, 'ai_overview', 'completed')
      const result = await runStepAction(() => fetchPreviewLeadsAction(accountId))
      if (!result?.success) {
        setError(result?.error ?? 'Could not load preview leads. Try again.')
        return false
      }
      onLeadsReady(result.data.leads)
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setFetching(false)
    }
  }, [accountId, analysis, onLeadsReady])

  useRegisterOnboardingStep({
    canAdvance: Boolean(analysis),
    isSubmitting: fetching,
    primaryLabel: fetching ? 'Finding leads…' : 'Confirm & find leads',
    submit,
  })

  if (!analysis) {
    return (
      <StepError message="We need your business details from the previous step. Go back and try again." />
    )
  }

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-3">
      <motion.div variants={fadeUp} className="grid gap-2 sm:grid-cols-1">
        <InsightCard icon={Building2} label="Industry" value={analysis.industryLabel} />
        <InsightCard icon={Target} label="Ideal customer" value={analysis.icpSummary} />
        <InsightCard icon={Users} label="Who you reach" value={analysis.icpDescription} />
      </motion.div>
      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
