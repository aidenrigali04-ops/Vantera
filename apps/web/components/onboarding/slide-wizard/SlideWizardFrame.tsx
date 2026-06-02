'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type SlideWizardFrameSlide = {
  id: string
  eyebrow: string
  title: string
  body: string
}

type Props = {
  variant: 'overlay' | 'page' | 'fullscreen'
  open?: boolean
  headerLabel: string
  slide: SlideWizardFrameSlide
  stepIndex: number
  totalSteps: number
  mediaPanel: ReactNode
  children?: ReactNode
  onBack: () => void
  onPrimary: () => void
  onClose?: () => void
  primaryLabel: string
  primaryDisabled?: boolean
  primaryLoading?: boolean
  secondaryLabel?: string
  onSecondary?: () => void
  showSkip?: boolean
  skipLabel?: string
  dialogTitleId?: string
  dialogBodyId?: string
}

export function SlideWizardFrame({
  variant,
  open = true,
  headerLabel,
  slide,
  stepIndex,
  totalSteps,
  mediaPanel,
  children,
  onBack,
  onPrimary,
  onClose,
  primaryLabel,
  primaryDisabled,
  primaryLoading,
  secondaryLabel,
  onSecondary,
  showSkip = true,
  skipLabel = 'Skip',
  dialogTitleId = 'slide-wizard-title',
  dialogBodyId = 'slide-wizard-body',
}: Props) {
  const reduceMotion = useReducedMotion()
  const dialogRef = useRef<HTMLDivElement>(null)
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (!isFirst) onBack()
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
  }, [open, onClose, onBack, onPrimary, isFirst, primaryDisabled, primaryLoading])

  useEffect(() => {
    if (!open || (variant !== 'overlay' && variant !== 'fullscreen')) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, variant])

  useEffect(() => {
    if (!open || !dialogRef.current) return
    dialogRef.current.focus()
  }, [open, stepIndex])

  if (!open) return null

  const dialog = (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogTitleId}
      aria-describedby={dialogBodyId}
      tabIndex={-1}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 4 }}
      transition={{ duration: DURATION.modal, ease: EASE_OUT }}
      className={cn(
        'flex max-h-[min(720px,calc(100dvh-2rem))] w-full max-w-[880px] flex-col overflow-hidden rounded-xl border border-[var(--border-default)]',
        'bg-[var(--bg-elevated)] shadow-[var(--shadow-lg)] outline-none',
        variant === 'fullscreen' && 'max-h-[min(720px,calc(100dvh-2rem))]',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          {headerLabel}
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors duration-[120ms] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <span className="w-7" aria-hidden />
        )}
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-b border-[var(--border-subtle)] p-4 lg:block lg:min-h-0 lg:border-b-0 lg:p-5">
          {mediaPanel}
        </div>

        <div className="flex min-h-0 flex-col border-t border-[var(--border-subtle)] lg:border-l lg:border-t-0">
          <div className="flex flex-1 flex-col overflow-hidden p-5 lg:p-6">
            <div className="shrink-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--brand-accent)]">
                {slide.eyebrow}
              </p>
              <h2
                id={dialogTitleId}
                className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]"
              >
                {slide.title}
              </h2>
              <p
                id={dialogBodyId}
                className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]"
              >
                {slide.body}
              </p>
            </div>

            {children ? (
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-4 border-t border-[var(--border-subtle)] px-5 py-4 lg:px-6">
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: totalSteps }).map((_, index) => (
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
                ) : showSkip && onClose && !isLast ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="hidden h-9 rounded-lg px-3 text-[13px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] sm:inline-flex"
                  >
                    {skipLabel}
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={onPrimary}
                  disabled={primaryDisabled || primaryLoading}
                  className={cn(
                    'inline-flex h-9 min-w-[108px] items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium',
                    'bg-[var(--brand-accent)] text-[var(--text-inverse)]',
                    'transition-colors duration-[120ms] hover:bg-[var(--brand-accent-hover)]',
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
        </div>
      </div>
    </motion.div>
  )

  if (variant === 'page') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)] p-4 sm:p-6">
        {dialog}
      </div>
    )
  }

  if (variant === 'fullscreen') {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg-base)] p-4 sm:p-6">
        {dialog}
      </div>,
      document.body,
    )
  }

  return createPortal(
    <AnimatePresence>
      <>
        <motion.button
          type="button"
          aria-label="Close"
          className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.fade }}
          onClick={onClose}
        />
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6">
          {dialog}
        </div>
      </>
    </AnimatePresence>,
    document.body,
  )
}
