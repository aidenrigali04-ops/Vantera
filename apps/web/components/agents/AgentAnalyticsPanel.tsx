'use client'

import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { cn } from '@/lib/utils'
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
        'flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Analytics</h2>
          {live !== undefined ? <LiveIndicator active={live} /> : null}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          Live
        </span>
      </div>

      {kpis && kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-px border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-[var(--bg-surface)] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                {kpi.label}
              </p>
              <p className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  )
}
