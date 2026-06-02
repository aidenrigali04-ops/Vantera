'use client'

import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { getOnboardingProfile, saveOnboardingIcp } from '../actions'
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
}

export function Step2Icp({ accountId }: Props) {
  const [icp, setIcp] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await runStepAction(() => getOnboardingProfile(accountId))
        if (cancelled) return
        if (result?.success && result.data.icpDescription) {
          setIcp(result.data.icpDescription)
        }
      } catch (err) {
        rethrowFrameworkNavigation(err)
        console.warn('[Step2Icp] load failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [accountId])

  const trimmed = icp.trim()
  const canAdvance = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH

  const submit = useCallback(async (): Promise<boolean> => {
    if (!canAdvance) {
      setError('Describe your ideal customer in at least a few sentences')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() => saveOnboardingIcp(accountId, trimmed))

      if (!result?.success) {
        setError(result?.error ?? 'Could not save your ICP')
        return false
      }

      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [accountId, canAdvance, trimmed])

  useRegisterOnboardingStep({
    canAdvance: !loading && canAdvance,
    isSubmitting: saving,
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
          label="Describe your ideal customer"
          description="Who do you sell to? Include industry, company size, role, geography, and pain points — this powers Aspire prospecting and outreach."
        >
          <Textarea
            id="onboarding-icp"
            value={icp}
            onChange={(event) => setIcp(event.target.value)}
            placeholder="e.g. Marketing directors at B2B SaaS companies with 50–200 employees in the US, struggling to generate qualified pipeline without hiring more SDRs…"
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
