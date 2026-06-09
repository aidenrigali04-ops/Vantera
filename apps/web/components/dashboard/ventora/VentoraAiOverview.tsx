'use client'

import { IconTile } from '@/components/shared/IconTile'
import { DURATION, EASE_OUT, fadeUp } from '@/lib/motion'
import { motion, useReducedMotion } from 'framer-motion'
import { MoreHorizontal, Sparkles } from 'lucide-react'

type Props = {
  headline?: string
  body?: string
  progress?: number | null
}

export function VentoraAiOverview({
  headline = 'Vantera AI',
  body = 'Recommendations appear here as your pipeline and outreach activity grows.',
  progress = null,
}: Props) {
  const reduced = useReducedMotion()
  const showProgress = typeof progress === 'number' && progress > 0
  const width = showProgress ? Math.min(100, Math.max(8, progress)) : 0

  return (
    <motion.section
      className="card-surface flex h-full min-h-[280px] flex-col p-4 sm:p-5"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Overview</h2>
        <button type="button" aria-label="AI overview options" className="icon-btn">
          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex items-center gap-2">
          <motion.div
            animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <IconTile icon={Sparkles} size="sm" />
          </motion.div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{headline}</p>
        </div>
        <p className="mt-3 max-w-[28ch] text-balance text-sm leading-relaxed text-[var(--text-secondary)]">
          {body}
        </p>

        {showProgress ? (
          <div className="mt-auto pt-6">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-default)]">
              <motion.div
                className="h-full rounded-full bg-[var(--accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: DURATION.page, ease: EASE_OUT, delay: 0.12 }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Pipeline sync · {progress}% complete
            </p>
          </div>
        ) : null}
      </div>
    </motion.section>
  )
}
