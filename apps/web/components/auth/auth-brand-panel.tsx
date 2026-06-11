'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion } from 'framer-motion'
import { TestimonialCards } from './testimonial-cards'

/** Right column — social proof during auth: operator testimonials. */
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
        className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--highlight)]"
        aria-hidden
      />

      <div className="mx-auto w-full max-w-[440px] space-y-8">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--highlight-text)]">
            Trusted by operators
          </p>
          <h2 className="font-heading text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text-primary)]">
            Service businesses run tighter on Vantera.
          </h2>
        </div>

        <TestimonialCards />
      </div>
    </motion.aside>
  )
}
