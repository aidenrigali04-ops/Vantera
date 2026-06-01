'use client'

import { GuidedExplorationTooltip } from '@/components/onboarding/GuidedExplorationTooltip'
import { isProductTourComplete, PRODUCT_TOUR_COMPLETED_EVENT } from '@/lib/onboarding/product-tour'
import type { TourStepId } from '@/lib/onboarding/tour'
import { isTourStepEligible, nextEligibleTourStep } from '@/lib/onboarding/tour'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

type Props = {
  accountId: string
  enabled: boolean
  /** Wait for the slideshow product tour before showing scattered tooltips. */
  deferUntilProductTour?: boolean
}

/**
 * Contextual onboarding coach — max one tooltip at a time, never repeats after dismiss.
 */
export function GuidedExplorationHost({
  accountId,
  enabled,
  deferUntilProductTour = false,
}: Props) {
  const pathname = usePathname() ?? ''
  const [activeStep, setActiveStep] = useState<TourStepId | null>(null)
  const [actionFeedDelayElapsed, setActionFeedDelayElapsed] = useState(false)
  const [pipelineSectionVisible, setPipelineSectionVisible] = useState(false)
  const [productTourDone, setProductTourDone] = useState(
    deferUntilProductTour ? isProductTourComplete(accountId) : true,
  )

  useEffect(() => {
    if (!deferUntilProductTour) return
    setProductTourDone(isProductTourComplete(accountId))

    function onTourCompleted(event: Event) {
      const detail = (event as CustomEvent<{ accountId: string }>).detail
      if (detail?.accountId === accountId) {
        setProductTourDone(true)
      }
    }

    window.addEventListener(PRODUCT_TOUR_COMPLETED_EVENT, onTourCompleted)
    return () => window.removeEventListener(PRODUCT_TOUR_COMPLETED_EVENT, onTourCompleted)
  }, [accountId, deferUntilProductTour])

  const coachEnabled = enabled && productTourDone

  // Tooltip 1 — Action Feed: 5 seconds on dashboard
  useEffect(() => {
    if (!coachEnabled) return
    setActionFeedDelayElapsed(false)
    if (pathname !== '/admin/dashboard') return

    const timer = window.setTimeout(() => setActionFeedDelayElapsed(true), 5000)
    return () => window.clearTimeout(timer)
  }, [coachEnabled, pathname])

  // Tooltip 2 — Pipeline revenue: when dashboard pipeline section enters view
  useEffect(() => {
    if (!coachEnabled || pathname !== '/admin/dashboard') {
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
  }, [coachEnabled, pathname])

  const evaluateNextStep = useCallback(() => {
    if (!coachEnabled) {
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
  }, [accountId, coachEnabled, pathname, actionFeedDelayElapsed, pipelineSectionVisible])

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

  if (!coachEnabled || !activeStep) return null

  return (
    <GuidedExplorationTooltip
      stepId={activeStep}
      accountId={accountId}
      onDismiss={handleDismiss}
    />
  )
}
