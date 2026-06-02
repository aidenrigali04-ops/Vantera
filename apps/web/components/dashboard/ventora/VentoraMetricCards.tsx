'use client'

import type { VentoraMetric, VentoraMetricIcon } from '@/lib/dashboard/ventora-types'
import { Calendar, LayoutGrid, MoreHorizontal, Trophy, type LucideIcon } from 'lucide-react'

const ICONS: Record<VentoraMetricIcon, LucideIcon> = {
  trophy: Trophy,
  grid: LayoutGrid,
  calendar: Calendar,
}

function CardMenu() {
  return (
    <button
      type="button"
      aria-label="Card options"
      className="icon-btn -mr-1 -mt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    >
      <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

type Props = {
  metrics: VentoraMetric[]
}

export function VentoraMetricCards({ metrics }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {metrics.map(({ label, value, iconName }) => {
        const Icon = ICONS[iconName]
        return (
          <article
            key={label}
            className="card-surface card-surface-interactive group relative flex flex-col gap-3 p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent-muted)]">
                <Icon size={18} className="text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
              </div>
              <CardMenu />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)] tabular-nums">
                {value}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
