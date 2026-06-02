'use client'

import { AuthFieldError, AuthFieldLabel, AuthInput } from '@/components/auth/auth-input'
import { OnboardingChoiceList } from '@/components/onboarding/onboarding-wizard/OnboardingChoiceList'
import {
  ONBOARDING_VERTICALS,
  VERTICAL_LABELS,
  type BusinessAnalysis,
  type OnboardingVertical,
} from '@/lib/onboarding/onboarding-wizard-types'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRegisterOnboardingStep } from '../onboarding-nav'
import { saveBusinessDetailsAndAnalyze } from '../actions'
import {
  StepError,
  fadeUp,
  rethrowFrameworkNavigation,
  runStepAction,
  stepContainer,
} from '../_primitives'

const VERTICAL_OPTIONS = ONBOARDING_VERTICALS.map((value) => ({
  value,
  label: VERTICAL_LABELS[value].split('&')[0]?.trim() ?? value,
  description: VERTICAL_LABELS[value],
}))

type Props = {
  accountId: string
  initialBusinessName: string
  initialWebsiteUrl: string | null
  currentVertical: string | null
  onComplete: (data: { analysis: BusinessAnalysis; businessName: string }) => void
}

export function Step1BusinessDetails({
  accountId,
  initialBusinessName,
  initialWebsiteUrl,
  currentVertical,
  onComplete,
}: Props) {
  const defaultName =
    initialBusinessName === 'Acme Agency' ? '' : initialBusinessName

  const [businessName, setBusinessName] = useState(defaultName)
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? '')
  const [showManualVertical, setShowManualVertical] = useState(false)
  const [manualVertical, setManualVertical] = useState<OnboardingVertical | null>(
    ONBOARDING_VERTICALS.includes(currentVertical as OnboardingVertical)
      ? (currentVertical as OnboardingVertical)
      : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canAdvance = useMemo(
    () => businessName.trim().length >= 2 && websiteUrl.trim().length >= 4,
    [businessName, websiteUrl],
  )

  const submit = useCallback(async (): Promise<boolean> => {
    if (!canAdvance) {
      setError('Enter your business name and website to continue')
      return false
    }

    setError(null)
    setSaving(true)

    try {
      const result = await runStepAction(() =>
        saveBusinessDetailsAndAnalyze(accountId, {
          businessName: businessName.trim(),
          websiteUrl: websiteUrl.trim(),
          manualVertical: showManualVertical ? manualVertical : null,
        }),
      )

      if (result == null) {
        setError('The server did not respond. Refresh the page and try again.')
        return false
      }

      if (result.success !== true) {
        setError(('error' in result && result.error) || 'Could not analyze your business. Try again.')
        return false
      }

      onComplete({
        analysis: result.data.analysis,
        businessName: businessName.trim(),
      })
      return true
    } catch (err) {
      rethrowFrameworkNavigation(err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    accountId,
    businessName,
    canAdvance,
    manualVertical,
    onComplete,
    showManualVertical,
    websiteUrl,
  ])

  useRegisterOnboardingStep({
    canAdvance,
    isSubmitting: saving,
    submit,
    primaryLabel: saving ? 'Analyzing…' : 'Continue',
  })

  return (
    <motion.div variants={stepContainer} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={fadeUp} className="space-y-1.5">
        <AuthFieldLabel htmlFor="onboarding-business-name">Business name</AuthFieldLabel>
        <AuthInput
          id="onboarding-business-name"
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          autoComplete="organization"
          placeholder="Acme Agency"
          disabled={saving}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="space-y-1.5">
        <AuthFieldLabel htmlFor="onboarding-website">Website URL</AuthFieldLabel>
        <AuthInput
          id="onboarding-website"
          value={websiteUrl}
          onChange={(event) => setWebsiteUrl(event.target.value)}
          autoComplete="url"
          inputMode="url"
          placeholder="https://acmeagency.com"
          disabled={saving}
        />
        <p className="text-[12px] text-[var(--text-tertiary)]">
          We use this to identify your industry and ideal customers — usually takes a few seconds.
        </p>
      </motion.div>

      <motion.div variants={fadeUp}>
        <button
          type="button"
          onClick={() => setShowManualVertical((open) => !open)}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          {showManualVertical ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
          Prefer to pick your industry yourself?
        </button>

        {showManualVertical ? (
          <div className="mt-3">
            <OnboardingChoiceList
              options={VERTICAL_OPTIONS}
              selected={manualVertical}
              onSelect={(value) => setManualVertical(value as OnboardingVertical)}
            />
          </div>
        ) : null}
      </motion.div>

      {error ? <StepError message={error} /> : null}
    </motion.div>
  )
}
