import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type KpiItem = {
  label: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: LucideIcon
}

type KpiStripProps = {
  items: KpiItem[]
  className?: string
}

export function KpiStrip({ items, className }: KpiStripProps) {
  return (
    <div
      className={cn(
        'grid gap-3',
        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="card-surface min-w-0 px-4 py-3"
          >
            <div className="mb-2 flex min-w-0 items-center gap-2">
              {Icon ? (
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
              ) : null}
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-secondary)]">
                {item.label}
              </p>
            </div>
            <p className="truncate text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {item.value}
            </p>
            {item.change ? (
              <p
                className={cn(
                  'mt-1 truncate text-[11px] font-medium',
                  item.trend === 'up' && 'text-[var(--success)]',
                  item.trend === 'down' && 'text-[var(--danger)]',
                  (!item.trend || item.trend === 'neutral') && 'text-[var(--text-secondary)]',
                )}
              >
                {item.change}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
