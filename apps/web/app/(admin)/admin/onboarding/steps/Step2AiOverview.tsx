'use client'

import { IconTile } from '@/components/shared/IconTile'
import type { BusinessAnalysis, PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'
import { motion } from 'framer-motion'
import { Building2, Pencil, Target } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import {
  fetchPreviewLeadsAction,
  recordOnboardingStepEvent,
  saveOnboardingIcp,
} from '../actions'
import { StepError, fadeUp, rethrowFrameworkNavigation, runStepAction, stepContainer } from '../_primitives'

type Props = {
  accountId: string
  analysis: BusinessAnalysis | null
  onLeadsReady: (leads: PreviewLead[]) => void
  onAnalysisChange?: (analysis: BusinessAnalysis) => void
}

export function Step2AiOverview({ accountId, analysis, onLeadsReady, onAnalysisChange }: Props) {
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [icpDraft, setIcpDraft] = useState(analysis?.icpDescription ?? '')

  const icpEdited = analysis != null && icpDraft.trim() !== analysis.icpDescription.trim()
  const icpValid = icpDraft.trim().length >= 10

  const submit = useCallback(async (): Promise<boolean> => {
    if (!analysis) return false
    if (!icpValid) {
      setError('Describe your ideal customer in at least a short sentence.')
      return false
    }
    setError(null)
    setFetching(true)
    try {
      // Persist a corrected ICP first — lead discovery reads it server-side.
      if (icpEdited) {
        const saved = await runStepAction(() => saveOnboardingIcp(accountId, icpDraft.trim()))
        if (!saved?.success) {
          setError(saved?.error ?? 'Could not save your ideal customer description. Try again.')
          return false
        }
        onAnalysisChange?.({ ...analysis, icpDescription: icpDraft.trim() })
      }

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
  }, [accountId, analysis, icpDraft, icpEdited, icpValid, onAnalysisChange, onLeadsReady])

  useRegisterOnboardingStep({
    canAdvance: Boolean(analysis) && icpValid,
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
      <motion.div variants={fadeUp} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Building2} size="sm" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
              Industry
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-primary)]">
              {analysis.industryLabel}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              Not right? Go back and pick your industry manually.
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Target} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="onboarding-icp"
                className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]"
              >
                Ideal customer
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--highlight-text)]">
                <Pencil className="h-3 w-3" aria-hidden />
                Editable
              </span>
            </div>
            <textarea
              id="onboarding-icp"
              value={icpDraft}
              onChange={(event) => setIcpDraft(event.target.value)}
              disabled={fetching}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-2 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--text-disabled)] focus-visible:border-[var(--border-focus)] focus-visible:shadow-[var(--shadow-glow)] disabled:opacity-60"
              placeholder="e.g. Owners of HVAC companies with 5–50 employees in Texas"
            />
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              {icpEdited
                ? 'We will use your edited description to find leads.'
                : 'This drives who your agent reaches out to — fix anything that looks off.'}
            </p>
          </div>
        </div>
      </motion.div>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
