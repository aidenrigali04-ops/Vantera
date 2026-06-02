'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { UiPreviewMock } from './ui-preview-mock'

const TRUST_LINES = [
  'Full client lifecycle in one place',
  'Built for service-based businesses',
  'Replace fragmented tools with one system',
] as const

/** Right column — brand reinforcement during auth with live dashboard preview. */
export function AuthBrandPanel() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.aside
      className={cn(
        'relative hidden min-h-[100dvh] flex-col justify-center',
        'border-l border-[var(--border-default)] bg-[var(--bg-subtle)]',
        'px-8 py-12 xl:px-10',
        'lg:flex',
      )}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT, delay: reduceMotion ? 0 : 0.06 }}
      aria-label="Vantera product overview"
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[var(--accent)]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[440px] space-y-8">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent-hover)]">
            Your workspace preview
          </p>
          <h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">
            Run your business from one system
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Centralize revenue, operations, and client delivery in a structured workspace — the same
            view you&apos;ll see after sign-in.
          </p>
        </div>

        <UiPreviewMock />

        <ul className="space-y-3" aria-label="Product highlights">
          {TRUST_LINES.map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-[13px] leading-snug text-[var(--text-secondary)]"
            >
              <span
                className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-[10px] font-semibold text-[var(--accent-hover)]"
                aria-hidden
              >
                ✦
              </span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </motion.aside>
  )
}
