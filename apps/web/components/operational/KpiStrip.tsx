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
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', className)}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 shadow-sm"
          >
            <div className="mb-1.5 flex items-center gap-2">
              {Icon ? <Icon className="h-3.5 w-3.5 text-stone-400" aria-hidden /> : null}
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                {item.label}
              </p>
            </div>
            <p className="text-xl font-semibold text-stone-900">{item.value}</p>
            {item.change ? (
              <p
                className={cn(
                  'mt-0.5 text-[11px] font-medium',
                  item.trend === 'up' && 'text-emerald-600',
                  item.trend === 'down' && 'text-red-600',
                  (!item.trend || item.trend === 'neutral') && 'text-stone-500',
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
