'use client'

import { GuidedExplorationTooltip } from '@/components/onboarding/GuidedExplorationTooltip'
import type { TourStepId } from '@/lib/onboarding/tour'
import { isTourStepEligible, nextEligibleTourStep } from '@/lib/onboarding/tour'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Props = {
  accountId: string
  enabled: boolean
}

/**
 * Contextual onboarding coach — max one tooltip at a time, never repeats after dismiss.
 */
export function GuidedExplorationHost({ accountId, enabled }: Props) {
  const pathname = usePathname() ?? ''
  const [activeStep, setActiveStep] = useState<TourStepId | null>(null)
  const [actionFeedDelayElapsed, setActionFeedDelayElapsed] = useState(false)
  const [pipelineSectionVisible, setPipelineSectionVisible] = useState(false)

  // Tooltip 1 — Action Feed: 5 seconds on dashboard
  useEffect(() => {
    if (!enabled) return
    setActionFeedDelayElapsed(false)
    if (pathname !== '/admin/dashboard') return

    const timer = window.setTimeout(() => setActionFeedDelayElapsed(true), 5000)
    return () => window.clearTimeout(timer)
  }, [enabled, pathname])

  // Tooltip 2 — Pipeline revenue: when dashboard pipeline section enters view
  useEffect(() => {
    if (!enabled || pathname !== '/admin/dashboard') {
      setPipelineSectionVisible(false)
      return
    }

    const el = document.querySelector('[data-tour="dashboard-pipeline"]')
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setPipelineSectionVisible(true)
      },
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, pathname])

  const evaluateNextStep = useCallback(() => {
    if (!enabled) {
      setActiveStep(null)
      return
    }

    setActiveStep(
      nextEligibleTourStep(accountId, {
        pathname,
        actionFeedDelayElapsed,
        pipelineSectionVisible,
      }),
    )
  }, [accountId, enabled, pathname, actionFeedDelayElapsed, pipelineSectionVisible])

  useEffect(() => {
    if (activeStep) return
    evaluateNextStep()
  }, [activeStep, evaluateNextStep])

  // Close tooltip without marking seen if user navigates away from its context
  useEffect(() => {
    if (!activeStep) return
    const stillHere = isTourStepEligible(accountId, activeStep, {
      pathname,
      actionFeedDelayElapsed,
      pipelineSectionVisible,
    })
    if (!stillHere) setActiveStep(null)
  }, [pathname, activeStep, accountId, actionFeedDelayElapsed, pipelineSectionVisible])

  function handleDismiss() {
    setActiveStep(null)
    window.setTimeout(evaluateNextStep, 350)
  }

  if (!enabled || !activeStep) return null

  return (
    <GuidedExplorationTooltip
      stepId={activeStep}
      accountId={accountId}
      onDismiss={handleDismiss}
    />
  )
}
