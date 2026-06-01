'use client'

import type { TourStepId } from '@/lib/onboarding/tour'
import { TOUR_STEPS, markTourStepSeen } from '@/lib/onboarding/tour'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  stepId: TourStepId
  accountId: string
  onDismiss: () => void
}

type Position = {
  top: number
  left: number
  width: number
  placement: 'bottom' | 'center'
}

function measureAnchor(selector: string): Position | null {
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  const maxWidth = Math.min(320, window.innerWidth - 32)
  const left = Math.max(
    16,
    Math.min(rect.left + rect.width / 2 - maxWidth / 2, window.innerWidth - maxWidth - 16),
  )
  return {
    top: rect.bottom + 12,
    left,
    width: maxWidth,
    placement: 'bottom',
  }
}

export function GuidedExplorationTooltip({ stepId, accountId, onDismiss }: Props) {
  const step = TOUR_STEPS[stepId]
  const [position, setPosition] = useState<Position | null>(null)
  const [mounted, setMounted] = useState(false)

  const updatePosition = useCallback(() => {
    const measured = measureAnchor(step.anchor)
    if (measured) {
      setPosition(measured)
      return
    }
    setPosition({
      top: window.innerHeight / 2 - 80,
      left: Math.max(16, (window.innerWidth - 320) / 2),
      width: Math.min(320, window.innerWidth - 32),
      placement: 'center',
    })
  }, [step.anchor])

  useEffect(() => {
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition, stepId])

  function dismiss() {
    markTourStepSeen(accountId, stepId)
    onDismiss()
  }

  if (!mounted || !position) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90] bg-stone-900/10" aria-hidden onClick={dismiss} />
      <AnimatePresence>
        <motion.div
          key={stepId}
          role="dialog"
          aria-labelledby={`tour-title-${stepId}`}
          initial={{ opacity: 0, y: position.placement === 'bottom' ? -6 : 0, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: DURATION.modal, ease: EASE_OUT }}
          className={cn(
            'fixed z-[91] rounded-xl border border-stone-200 bg-white p-4 shadow-sm',
          )}
          style={{ top: position.top, left: position.left, width: position.width }}
        >
          <div className="flex items-start justify-between gap-3">
            <p id={`tour-title-${stepId}`} className="text-sm leading-relaxed text-stone-700">
              {step.message}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="shrink-0 rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium text-stone-700',
                'transition-colors hover:bg-stone-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
              )}
            >
              Got it
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>,
    document.body,
  )
}
