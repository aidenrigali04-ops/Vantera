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

/** Right column — brand reinforcement during auth (calm, enterprise, no gradients). */
export function AuthBrandPanel() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.aside
      className={cn(
        'relative hidden min-h-[100dvh] flex-col justify-center',
        'border-l border-stone-200 bg-stone-50',
        'px-10 py-16 xl:px-14',
        'lg:flex',
      )}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.page, ease: EASE_OUT, delay: reduceMotion ? 0 : 0.06 }}
      aria-label="Ventaro product overview"
    >
      <div className="mx-auto w-full max-w-md space-y-10">
        <div className="space-y-4">
          <h2 className="text-[30px] font-semibold leading-[1.2] tracking-[-0.03em] text-stone-900">
            Run Your Business From One System
          </h2>
          <p className="text-[15px] leading-relaxed text-stone-600">
            Centralizes your revenue, operations, and client delivery into one structured workspace.
          </p>
        </div>

        <UiPreviewMock />

        <ul className="space-y-3.5" aria-label="Product highlights">
          {TRUST_LINES.map((line) => (
            <li key={line} className="flex items-start gap-3 text-[13px] leading-snug text-stone-700">
              <span className="mt-0.5 shrink-0 text-stone-400" aria-hidden>
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
