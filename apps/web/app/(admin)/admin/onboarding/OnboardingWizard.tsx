'use client'

import { OnboardingMediaPanel } from '@/components/onboarding/onboarding-wizard/OnboardingMediaPanel'
import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
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
import { Step1BusinessType } from './steps/Step1BusinessType'
import { Step2Branding } from './steps/Step2Branding'
import { Step3Profile } from './steps/Step3Profile'
import { Step3Template as Step4Template } from './steps/Step3Template'
import { Step4Team as Step5Team } from './steps/Step4Team'
import { Step5Connections as Step6Connections } from './steps/Step5Connections'

type Props = {
  accountId: string
  businessName: string
  currentVertical: string | null
  initialPrimaryColor: string
  initialSecondaryColor: string
  initialLogoUrl: string | null
  initialPortalDomain: string
}

function OnboardingWizardInner({
  accountId,
  businessName,
  currentVertical,
  initialPrimaryColor,
  initialSecondaryColor,
  initialLogoUrl,
  initialPortalDomain,
}: Props) {
  const router = useRouter()
  const storageKey = `vantera_onboarding_step_${accountId}`
  const { runSubmit, runSecondary, nav } = useOnboardingNavActions()

  const [stepIndex, setStepIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  const [vertical, setVertical] = useState<string | null>(currentVertical)
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor)
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [portalDomain, setPortalDomain] = useState(initialPortalDomain)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as { step?: number }
        if (typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= ONBOARDING_WIZARD_SLIDES.length) {
          setStepIndex(parsed.step - 1)
        }
      }
    } catch {
      /* ignore corrupt localStorage */
    }
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ step: stepIndex + 1 }))
    } catch {
      /* ignore */
    }
  }, [stepIndex, storageKey, hydrated])

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

  const handleSecondary = useCallback(async () => {
    await runSecondary()
    if (!meta.isLast) advance()
  }, [runSecondary, meta.isLast, advance])

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
    <SlideWizardFrame
      variant="overlay"
      open
      headerLabel={headerLabel}
      slide={slide}
      stepIndex={stepIndex}
      totalSteps={ONBOARDING_WIZARD_SLIDES.length}
      mediaPanel={
        <OnboardingMediaPanel media={slide.media} slideId={slide.id} className="h-full lg:min-h-[320px]" />
      }
      onBack={goBack}
      onPrimary={handlePrimary}
      primaryLabel={primaryLabel}
      primaryDisabled={!nav.canAdvance}
      primaryLoading={nav.isSubmitting}
      secondaryLabel={nav.secondaryLabel}
      onSecondary={nav.secondaryLabel ? handleSecondary : undefined}
      showSkip={false}
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
          className="space-y-4"
        >
          {stepIndex === 0 ? (
            <Step1BusinessType
              accountId={accountId}
              currentVertical={vertical}
              primaryColor={primaryColor}
              onComplete={(data) => {
                setVertical(data.vertical)
              }}
            />
          ) : null}

          {stepIndex === 1 ? (
            <Step2Branding
              accountId={accountId}
              businessName={businessName}
              initialLogoUrl={logoUrl}
              initialPrimary={primaryColor}
              initialSecondary={secondaryColor}
              initialPortalDomain={portalDomain}
              onComplete={(data) => {
                setLogoUrl(data.logoUrl)
                setPrimaryColor(data.primaryColor)
                setSecondaryColor(data.secondaryColor)
                setPortalDomain(data.portalDomain)
              }}
            />
          ) : null}

          {stepIndex === 2 ? (
            <Step3Profile
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={() => {}}
            />
          ) : null}

          {stepIndex === 3 ? (
            <Step4Template
              accountId={accountId}
              vertical={vertical}
              primaryColor={primaryColor}
              onComplete={() => {}}
            />
          ) : null}

          {stepIndex === 4 ? (
            <Step5Team
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={() => {}}
            />
          ) : null}

          {stepIndex === 5 ? (
            <Step6Connections
              accountId={accountId}
              primaryColor={primaryColor}
              onComplete={() => {}}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </SlideWizardFrame>
  )
}

export function OnboardingWizard(props: Props) {
  return (
    <OnboardingNavProvider>
      <OnboardingWizardInner {...props} />
    </OnboardingNavProvider>
  )
}
