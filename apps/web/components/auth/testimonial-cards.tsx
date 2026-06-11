'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { motion, useReducedMotion } from 'framer-motion'
import { Star } from 'lucide-react'

type Testimonial = {
  quote: string
  name: string
  role: string
}

/** Placeholder operator quotes — swap for real customer testimonials at launch. */
const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'We replaced four tools in the first week. Pipeline, outreach, and delivery finally live in one place.',
    name: 'Marcus T.',
    role: 'Agency owner',
  },
  {
    quote:
      'Eleven meetings booked in our first month. The follow-up automation alone pays for the seat.',
    name: 'Dana R.',
    role: 'HVAC services',
  },
  {
    quote:
      'Vantera is the first thing I open on Monday. It is how I know exactly where the business stands.',
    name: 'Priya S.',
    role: 'Consulting firm',
  },
]

function StarRow() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars" role="img">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="size-3 fill-[var(--highlight)] text-[var(--highlight)]"
          aria-hidden
        />
      ))}
    </div>
  )
}

/** Right-panel social proof — stacked operator testimonials with a staggered reveal. */
export function TestimonialCards() {
  const reduceMotion = useReducedMotion()

  return (
    <ul className="space-y-4" aria-label="Customer testimonials">
      {TESTIMONIALS.map((t, index) => (
        <motion.li
          key={t.name}
          className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: DURATION.page,
            ease: EASE_OUT,
            delay: reduceMotion ? 0 : 0.12 + index * 0.08,
          }}
        >
          <StarRow />
          <blockquote className="mt-3 text-[14px] leading-relaxed text-[var(--text-primary)]">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <span
              className="flex size-8 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-secondary)]"
              aria-hidden
            >
              {t.name.split(' ').map((part) => part[0]).join('')}
            </span>
            <span className="text-[13px]">
              <span className="font-medium text-[var(--text-primary)]">{t.name}</span>
              <span className="text-[var(--text-tertiary)]"> · {t.role}</span>
            </span>
          </figcaption>
        </motion.li>
      ))}
    </ul>
  )
}
