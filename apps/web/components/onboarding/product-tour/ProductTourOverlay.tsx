'use client'

import { ProductTourMediaPanel } from '@/components/onboarding/product-tour/ProductTourMediaPanel'
import { SlideWizardFrame } from '@/components/onboarding/slide-wizard/SlideWizardFrame'
import {
  PRODUCT_TOUR_SLIDES,
  getProductTourSlideMeta,
  markProductTourComplete,
  type ProductTourSlide,
} from '@/lib/onboarding/product-tour'
import { useCallback, useEffect, useState } from 'react'

type Props = {
  open: boolean
  accountId: string
  onClose: () => void
  /** When true, finishing the tour writes completion to localStorage. */
  persistCompletion?: boolean
}

export function ProductTourOverlay({
  open,
  accountId,
  onClose,
  persistCompletion = true,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const slide = PRODUCT_TOUR_SLIDES[stepIndex] as ProductTourSlide | undefined
  const meta = getProductTourSlideMeta(stepIndex)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      setStepIndex(0)
    }
  }, [open])

  const finish = useCallback(() => {
    if (persistCompletion) {
      markProductTourComplete(accountId)
    }
    onClose()
  }, [accountId, onClose, persistCompletion])

  const goNext = useCallback(() => {
    if (meta.isLast) {
      finish()
      return
    }
    setStepIndex((current) => Math.min(current + 1, PRODUCT_TOUR_SLIDES.length - 1))
  }, [finish, meta.isLast])

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(current - 1, 0))
  }, [])

  if (!mounted || !open || !slide) return null

  return (
    <SlideWizardFrame
      variant="overlay"
      open={open}
      headerLabel={`Product tour · ${meta.index + 1} / ${meta.total}`}
      slide={slide}
      stepIndex={stepIndex}
      totalSteps={PRODUCT_TOUR_SLIDES.length}
      mediaPanel={
        <ProductTourMediaPanel media={slide.media} slideId={slide.id} className="h-full lg:min-h-[320px]" />
      }
      onBack={goBack}
      onPrimary={goNext}
      onClose={finish}
      primaryLabel={meta.isLast ? 'Start exploring' : 'Next'}
      showSkip
      skipLabel="Skip"
      dialogTitleId="product-tour-title"
      dialogBodyId="product-tour-body"
    />
  )
}
