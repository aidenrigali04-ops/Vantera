'use client'

import { ProductTourMediaPanel } from '@/components/onboarding/product-tour/ProductTourMediaPanel'
import {
  PRODUCT_TOUR_SLIDES,
  getProductTourSlideMeta,
  markProductTourComplete,
  type ProductTourSlide,
} from '@/lib/onboarding/product-tour'
import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
  const reduceMotion = useReducedMotion()
  const [stepIndex, setStepIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish()
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault()
        goNext()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goBack()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, finish, goNext, goBack])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open || !dialogRef.current) return
    dialogRef.current.focus()
  }, [open, stepIndex])

  if (!mounted || !open || !slide) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close product tour"
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.fade }}
            onClick={finish}
          />

          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-tour-title"
              aria-describedby="product-tour-body"
              tabIndex={-1}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: DURATION.modal, ease: EASE_OUT }}
              className={cn(
                'w-full max-w-[880px] overflow-hidden rounded-xl border border-[var(--border-default)]',
                'bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)] outline-none',
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  Product tour · {meta.index + 1} / {meta.total}
                </p>
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors duration-[120ms] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]"
                  aria-label="Skip tour"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                <ProductTourMediaPanel media={slide.media} slideId={slide.id} className="lg:min-h-[320px]" />

                <div className="flex flex-col justify-between border-t border-[var(--border-subtle)] p-5 lg:border-l lg:border-t-0 lg:p-6">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--brand-accent)]">
                      {slide.eyebrow}
                    </p>
                    <h2
                      id="product-tour-title"
                      className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
                    >
                      {slide.title}
                    </h2>
                    <p id="product-tour-body" className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {slide.body}
                    </p>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-1.5" aria-hidden>
                      {PRODUCT_TOUR_SLIDES.map((_, index) => (
                        <span
                          key={index}
                          className={cn(
                            'h-1.5 rounded-full transition-all duration-[160ms]',
                            index === stepIndex
                              ? 'w-6 bg-[var(--brand-accent)]'
                              : 'w-1.5 bg-[var(--border-strong)]',
                          )}
                        />
                      ))}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={meta.isFirst}
                        className={cn(
                          'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium',
                          'text-[var(--text-secondary)] transition-colors duration-[120ms]',
                          'hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]',
                          'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                          'disabled:pointer-events-none disabled:opacity-40',
                        )}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={finish}
                          className="hidden h-9 rounded-lg px-3 text-[13px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] sm:inline-flex"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          className={cn(
                            'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium',
                            'bg-[var(--brand-accent)] text-[var(--text-inverse)]',
                            'transition-colors duration-[120ms] hover:bg-[var(--brand-accent-hover)]',
                            'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                          )}
                        >
                          {meta.isLast ? 'Start exploring' : 'Next'}
                          {!meta.isLast ? <ArrowRight className="h-4 w-4" /> : null}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
