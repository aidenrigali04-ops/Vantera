'use client'

import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { finishOnboardingSetup, getOnboardingProfile } from '../actions'
import {
  FieldGroup,
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

const MIN_LENGTH = 20
const MAX_LENGTH = 2000

type Props = {
  accountId: string
  vertical: string | null
  onComplete: () => void
}

export function Step3ValueProposition({ accountId, vertical, onComplete }: Props) {
  const [valueProp, setValueProp] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await runStepAction(() => getOnboardingProfile(accountId))
        if (cancelled) return
        if (result?.success && result.data.valueProposition) {
          setValueProp(result.data.valueProposition)
        }
      } catch (err) {
        rethrowFrameworkNavigation(err)
        console.warn('[Step3ValueProposition] load failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accountId])

  const trimmed = valueProp.trim()
  const canAdvance = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH

  const submit = useCallback(async (): Promise<boolean> => {
    if (!canAdvance) {
      setError('Describe the solutions you provide in at least a few sentences')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() =>
        finishOnboardingSetup(accountId, trimmed, vertical),
      )

      if (!result?.success) {
        setError(result?.error ?? 'Could not finish setup')
        return false
      }

      onComplete()
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [accountId, canAdvance, onComplete, trimmed, vertical])

  useRegisterOnboardingStep({
    canAdvance: !loading && canAdvance,
    isSubmitting: saving,
    primaryLabel: 'Finish setup',
    submit,
  })

  if (loading) {
    return (
      <motion.div variants={stepContainer} initial="hidden" animate="show">
        <motion.div
          variants={fadeUp}
          className="h-32 animate-pulse rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]"
        />
      </motion.div>
    )
  }

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp}>
        <FieldGroup
          label="What value do you provide?"
          description="Describe the outcomes and solutions you deliver for customers. This shapes AI messaging, recommendations, and how we position you in outreach."
        >
          <Textarea
            id="onboarding-value-prop"
            value={valueProp}
            onChange={(event) => setValueProp(event.target.value)}
            placeholder="e.g. We help agencies book 15+ qualified sales calls per month through targeted outbound, without adding headcount — using AI-assisted research and personalized sequences…"
            rows={6}
            maxLength={MAX_LENGTH}
            className="min-h-[160px] resize-y border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--border-strong)]"
          />
          <p className="text-[11px] text-[var(--text-tertiary)]">
            {trimmed.length}/{MAX_LENGTH} characters
            {trimmed.length > 0 && trimmed.length < MIN_LENGTH
              ? ` · ${MIN_LENGTH - trimmed.length} more needed`
              : null}
          </p>
        </FieldGroup>
      </motion.div>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
