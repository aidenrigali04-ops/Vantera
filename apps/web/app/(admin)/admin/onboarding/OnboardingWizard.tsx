'use client'

import { OnboardingSingleFrame } from '@/components/onboarding/onboarding-wizard/OnboardingSingleFrame'
import type { BusinessAnalysis, PreviewLead, OnboardingStepId } from '@/lib/onboarding/onboarding-wizard-types'
import {
  getOnboardingWizardSlideMeta,
  ONBOARDING_WIZARD_SLIDES,
} from '@/lib/onboarding/wizard-slides'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  OnboardingNavProvider,
  useOnboardingNavActions,
} from './onboarding-nav'
import { recordOnboardingStepEvent } from './actions'
import { Step1BusinessDetails } from './steps/Step1BusinessDetails'
import { Step2AiOverview } from './steps/Step2AiOverview'
import { Step3LeadPreview } from './steps/Step3LeadPreview'
import { Step4Subscription } from './steps/Step4Subscription'

type StoredWizardState = {
  step?: number
  analysis?: BusinessAnalysis
  leads?: PreviewLead[]
}

const STEP_IDS: OnboardingStepId[] = [
  'business_details',
  'ai_overview',
  'lead_preview',
  'subscription',
]

type Props = {
  accountId: string
  businessName: string
  websiteUrl: string | null
  currentVertical: string | null
}

function OnboardingWizardInner({
  accountId,
  businessName,
  websiteUrl,
  currentVertical,
}: Props) {
  const router = useRouter()
  const storageKey = `vantera_onboarding_step_${accountId}`
  const { runSubmit, nav } = useOnboardingNavActions()

  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null)
  const [previewLeads, setPreviewLeads] = useState<PreviewLead[]>([])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as StoredWizardState
        if (
          typeof parsed.step === 'number' &&
          parsed.step >= 1 &&
          parsed.step <= ONBOARDING_WIZARD_SLIDES.length
        ) {
          setStepIndex(parsed.step - 1)
        }
        if (parsed.analysis) setAnalysis(parsed.analysis)
        if (Array.isArray(parsed.leads)) setPreviewLeads(parsed.leads)
      }
    } catch {
      /* ignore corrupt localStorage */
    }
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      const payload: StoredWizardState = {
        step: stepIndex + 1,
        analysis: analysis ?? undefined,
        leads: previewLeads.length > 0 ? previewLeads : undefined,
      }
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      /* ignore */
    }
  }, [stepIndex, storageKey, hydrated, analysis, previewLeads])

  useEffect(() => {
    if (!hydrated) return
    const stepId = STEP_IDS[stepIndex]
    if (!stepId) return
    void recordOnboardingStepEvent(accountId, stepId, 'viewed')
  }, [accountId, hydrated, stepIndex])

  const meta = getOnboardingWizardSlideMeta(stepIndex)
  const slide = ONBOARDING_WIZARD_SLIDES[stepIndex]!

  const advance = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, ONBOARDING_WIZARD_SLIDES.length - 1))
  }, [])

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0))
  }, [])

  const handleFinalComplete = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/dashboard'
    } else {
      router.push('/admin/dashboard')
    }
  }, [router, storageKey])

  const handlePrimary = useCallback(async () => {
    const ok = await runSubmit()
    if (!ok) return

    if (meta.isLast) {
      handleFinalComplete()
      return
    }
    advance()
  }, [runSubmit, meta.isLast, advance, handleFinalComplete])

  const primaryLabel = useMemo(() => {
    if (nav.primaryLabel) return nav.primaryLabel
    if (meta.isLast) return 'Finish setup'
    return 'Next'
  }, [nav.primaryLabel, meta.isLast])

  const headerLabel = useMemo(
    () => `Workspace setup · ${meta.index + 1} / ${meta.total}`,
    [meta.index, meta.total],
  )

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--bg-overlay)]" aria-hidden />
      </div>
    )
  }

  return (
    <OnboardingSingleFrame
      headerLabel={headerLabel}
      slide={slide}
      stepIndex={stepIndex}
      totalSteps={ONBOARDING_WIZARD_SLIDES.length}
      onBack={goBack}
      onPrimary={handlePrimary}
      primaryLabel={primaryLabel}
      primaryDisabled={!nav.canAdvance}
      primaryLoading={nav.isSubmitting}
      dialogTitleId="onboarding-wizard-title"
      dialogBodyId="onboarding-wizard-body"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {stepIndex === 0 ? (
            <Step1BusinessDetails
              accountId={accountId}
              initialBusinessName={businessName}
              initialWebsiteUrl={websiteUrl}
              currentVertical={currentVertical}
              onComplete={(data) => {
                setAnalysis(data.analysis)
              }}
            />
          ) : null}

          {stepIndex === 1 ? (
            <Step2AiOverview
              accountId={accountId}
              analysis={analysis}
              onLeadsReady={setPreviewLeads}
            />
          ) : null}

          {stepIndex === 2 ? <Step3LeadPreview leads={previewLeads} /> : null}

          {stepIndex === 3 ? (
            <Step4Subscription accountId={accountId} onComplete={() => {}} />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </OnboardingSingleFrame>
  )
}

export function OnboardingWizard(props: Props) {
  return (
    <OnboardingNavProvider>
      <OnboardingWizardInner {...props} />
    </OnboardingNavProvider>
  )
}
