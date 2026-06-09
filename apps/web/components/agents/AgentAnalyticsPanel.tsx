'use client'

import { LiveIndicator } from '@/components/operational/LiveIndicator'
import { IconTile } from '@/components/shared/IconTile'
import { cn } from '@/lib/utils'
import { Activity, Maximize2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

type Kpi = { label: string; value: string | number }

type Props = {
  title?: string
  subtitle?: string
  live?: boolean
  kpis?: Kpi[]
  children: ReactNode
  className?: string
  onRefresh?: () => void
}

export function AgentAnalyticsPanel({
  title = 'Activity & logs',
  subtitle,
  live,
  kpis,
  children,
  className,
  onRefresh,
}: Props) {
  return (
    <div
      className={cn(
        'agent-playground-grid relative flex h-full min-h-[420px] items-stretch justify-center overflow-y-auto p-4 md:p-8 lg:items-center',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]',
          'min-h-[min(640px,calc(100dvh-12rem))] lg:min-h-[520px]',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconTile icon={Activity} size="sm" />
            <div className="min-w-0">
              <h2 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{title}</h2>
              {subtitle ? (
                <p className="truncate text-[11px] text-[var(--text-secondary)]">{subtitle}</p>
              ) : null}
            </div>
            {live !== undefined ? <LiveIndicator active={live} /> : null}
          </div>
          <div className="flex items-center gap-1">
            {onRefresh ? (
              <button
                type="button"
                className="icon-btn"
                aria-label="Refresh activity"
                onClick={onRefresh}
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="icon-btn"
              aria-label="Expand analytics panel"
              disabled
            >
              <Maximize2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {kpis && kpis.length > 0 ? (
          <div className="grid grid-cols-2 gap-px border-b border-[var(--border-subtle)] bg-[var(--border-subtle)]">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-[var(--bg-surface)] px-4 py-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  {kpi.label}
                </p>
                <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] tabular-nums">
                  {kpi.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        <div className="border-t border-[var(--border-subtle)] px-4 py-2.5 text-center">
          <p className="text-[10px] font-medium tracking-wide text-[var(--text-tertiary)]">
            Powered by Vantera pipeline
          </p>
        </div>
      </div>
    </div>
  )
}
