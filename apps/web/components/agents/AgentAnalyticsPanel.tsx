'use client'

import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { cn } from '@/lib/utils'
import { Maximize2 } from 'lucide-react'
import type { ReactNode } from 'react'

type Kpi = { label: string; value: string | number }

type Props = {
  live?: boolean
  kpis?: Kpi[]
  children: ReactNode
  className?: string
}

export function AgentAnalyticsPanel({ live, kpis, children, className }: Props) {
  return (
    <div
      className={cn(
        'relative flex min-h-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      <div className="agent-analytics-glow pointer-events-none absolute inset-x-0 top-0 h-32" aria-hidden />

      <div className="relative flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-1.5 w-1.5 rounded-full bg-[var(--success)] ring-2 ring-[var(--success-muted)]"
            aria-hidden
          />
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Analytics</h2>
          {live !== undefined ? <LiveIndicator active={live} /> : null}
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Expand analytics panel"
          disabled
        >
          <Maximize2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {kpis && kpis.length > 0 ? (
        <div className="relative grid grid-cols-2 gap-px border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-[var(--bg-surface)] px-5 py-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                {kpi.label}
              </p>
              <p className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  )
}
