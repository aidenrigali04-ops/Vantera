'use client'

import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import {
  onboardingSuccessHref,
  onboardingSuccessLabel,
  type OnboardingSuccessNotice,
} from '@/lib/import/fields'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, MessageSquare, TrendingDown } from 'lucide-react'
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
  emptyMessage?: string
  successNotice?: OnboardingSuccessNotice | null
  onDismissSuccessNotice?: () => void
}

export function DashboardActionFeed({
  items,
  className,
  emptyMessage,
  successNotice,
  onDismissSuccessNotice,
}: Props) {
  const showEmpty = items.length === 0 && !successNotice

  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Action feed
        </h2>
        <span className="text-xs text-stone-400">
          {items.length + (successNotice ? 1 : 0)} items
        </span>
      </div>

      {successNotice ? (
        <div className="mb-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-4 py-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-950">
                {onboardingSuccessLabel(successNotice)}
              </p>
              <Link
                href={onboardingSuccessHref(successNotice)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-950"
                onClick={onDismissSuccessNotice}
              >
                Review your workspace
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>
            {onDismissSuccessNotice ? (
              <button
                type="button"
                className="text-xs text-emerald-700 hover:text-emerald-950"
                onClick={onDismissSuccessNotice}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showEmpty ? (
        <p className="text-sm text-stone-500">
          {emptyMessage ?? 'No urgent actions right now.'}
        </p>
      ) : items.length > 0 ? (
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
      ) : null}
    </section>
  )
}
