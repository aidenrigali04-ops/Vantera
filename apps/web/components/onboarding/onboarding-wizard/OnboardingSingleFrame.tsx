'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

export type OnboardingSingleFrameSlide = {
  id: string
  eyebrow: string
  title: string
  body: string
}

type Props = {
  headerLabel: string
  slide: OnboardingSingleFrameSlide
  stepIndex: number
  totalSteps: number
  children?: ReactNode
  onBack: () => void
  onPrimary: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  primaryLoading?: boolean
  secondaryLabel?: string
  onSecondary?: () => void
  dialogTitleId?: string
  dialogBodyId?: string
}

export function OnboardingSingleFrame({
  headerLabel,
  slide,
  stepIndex,
  totalSteps,
  children,
  onBack,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  dialogTitleId = 'onboarding-single-title',
  dialogBodyId = 'onboarding-single-body',
}: Props) {
  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault()
        onBack()
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'Enter') {
        if (primaryDisabled || primaryLoading) return
        event.preventDefault()
        onPrimary()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onBack, onPrimary, isFirst, primaryDisabled, primaryLoading])

  useEffect(() => {
    dialogRef.current?.focus()
  }, [stepIndex])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-4 sm:p-6">
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogBodyId}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.modal, ease: EASE_OUT }}
        className={cn(
          'w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border-default)]',
          'bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)] outline-none',
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            {headerLabel}
          </p>
        </div>

        <div className="px-5 py-5 sm:px-8 sm:py-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent)]">
            {slide.eyebrow}
          </p>
          <h1
            id={dialogTitleId}
            className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-2xl"
          >
            {slide.title}
          </h1>
          <p
            id={dialogBodyId}
            className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]"
          >
            {slide.body}
          </p>

          {children ? <div className="mt-5">{children}</div> : null}
        </div>

        <div className="space-y-4 border-t border-[var(--border-subtle)] px-5 py-4 sm:px-8">
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: totalSteps }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-[160ms]',
                  index === stepIndex ? 'w-6 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border-strong)]',
                )}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={isFirst}
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
              {secondaryLabel && onSecondary ? (
                <button
                  type="button"
                  onClick={onSecondary}
                  disabled={primaryLoading}
                  className="inline-flex h-9 rounded-lg px-3 text-[13px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)] disabled:opacity-50"
                >
                  {secondaryLabel}
                </button>
              ) : null}

              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled || primaryLoading}
                className={cn(
                  'inline-flex h-9 min-w-[108px] items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium',
                  'bg-[var(--accent)] text-[var(--text-primary)]',
                  'transition-colors duration-[120ms] hover:bg-[var(--accent-hover)]',
                  'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {primaryLoading ? 'Saving…' : primaryLabel}
                {!isLast && !primaryLoading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
