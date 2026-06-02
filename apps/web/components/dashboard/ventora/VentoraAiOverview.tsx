'use client'

import { MoreHorizontal, Sparkles } from 'lucide-react'

type Props = {
  headline?: string
  body?: string
  progress?: number
}

export function VentoraAiOverview({
  headline = 'Ventora AI',
  body = "We've built out your pipeline for your outreach campaign.",
  progress = 68,
}: Props) {
  return (
    <section className="card-surface flex h-full min-h-[280px] flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Overview</h2>
        <button type="button" aria-label="AI overview options" className="icon-btn">
          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--accent-muted)]">
            <Sparkles size={16} className="text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">{headline}</p>
        </div>
        <p className="mt-3 max-w-[28ch] text-balance text-sm leading-relaxed text-[var(--text-secondary)]">
          {body}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border-default)]">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            Pipeline sync · {progress}% complete
          </p>
        </div>
      </div>
    </section>
  )
}
