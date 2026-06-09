'use client'

import { cn } from '@/lib/utils'

type Props = {
  label: string
  detail?: string
  tone?: 'success' | 'warning' | 'neutral' | 'draft'
}

export function AgentStatusCard({ label, detail, tone = 'neutral' }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-[var(--shadow-sm)]">
      <span
        className={cn(
          'flex h-2 w-2 shrink-0 rounded-full',
          tone === 'success' && 'animate-pulse bg-[var(--success)]',
          tone === 'warning' && 'bg-[var(--warning)]',
          tone === 'draft' && 'bg-[var(--accent)]',
          tone === 'neutral' && 'bg-[var(--text-tertiary)]',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{label}</p>
        {detail ? (
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{detail}</p>
        ) : null}
      </div>
    </div>
  )
}
