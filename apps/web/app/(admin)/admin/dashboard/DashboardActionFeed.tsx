'use client'

import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import { cn } from '@/lib/utils'
import { AlertTriangle, Clock, MessageSquare, TrendingDown } from 'lucide-react'
import Link from 'next/link'

const ICONS = {
  stalled_deal: TrendingDown,
  overdue_task: Clock,
  churn_risk: AlertTriangle,
  reply_detected: MessageSquare,
  lead_activity: MessageSquare,
} as const

type Props = {
  items: ActionFeedItem[]
  className?: string
}

export function DashboardActionFeed({ items, className }: Props) {
  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Action feed
        </h2>
        <span className="text-xs text-stone-400">{items.length} items</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-stone-500">No urgent actions right now.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((item) => {
            const Icon = ICONS[item.type]
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex gap-3 py-3 transition-colors hover:bg-stone-50/80"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100">
                    <Icon className="h-4 w-4 text-stone-600" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{item.title}</p>
                    <p className="text-xs text-stone-500">{item.subtitle}</p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
