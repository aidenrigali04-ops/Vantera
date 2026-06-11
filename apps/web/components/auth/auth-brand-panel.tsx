'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { UiPreviewMock } from './ui-preview-mock'

const TRUST_LINES = [
  'Automated lead capture & routing',
  'Real-time revenue intelligence',
  'Unified client communication',
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
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--accent)]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[440px] space-y-8">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--accent-hover)]">
            Your workspace preview
          </p>
          <h2 className="font-heading text-[28px] font-semibold leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">
            Total visibility across your entire operation.
          </h2>
        </div>

        <ul className="space-y-3" aria-label="Product highlights">
          {TRUST_LINES.map((line) => (
            <li
              key={line}
              className="flex items-start gap-3 text-[13px] leading-snug text-[var(--text-secondary)]"
            >
              <span
                className="mt-[6px] size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                aria-hidden
              />
              {line}
            </li>
          ))}
        </ul>

        <UiPreviewMock />
      </div>
    </motion.aside>
  )
}
