'use client'

import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import {
  onboardingSuccessHref,
  onboardingSuccessLabel,
  type OnboardingSuccessNotice,
} from '@/lib/import/fields'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

const ICONS = {
  stalled_deal: TrendingDown,
  overdue_task: Clock,
  churn_risk: AlertTriangle,
  reply_detected: MessageSquare,
  lead_activity: MessageSquare,
} as const

const PRIORITY_STYLES = {
  stalled_deal: 'border-amber-200/80 bg-amber-50/40',
  overdue_task: 'border-red-200/80 bg-red-50/40',
  churn_risk: 'border-red-200/80 bg-red-50/50',
  reply_detected: 'border-blue-200/80 bg-blue-50/40',
  lead_activity: 'border-stone-200 bg-stone-50/80',
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
  const totalCount = items.length + (successNotice ? 1 : 0)
  const showEmpty = items.length === 0 && !successNotice

  return (
    <section
      className={cn(
        'rounded-xl border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-900/[0.02]',
        className,
      )}
      data-tour="action-feed"
    >
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-stone-400" aria-hidden />
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
                Operational intelligence
              </p>
            </div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-stone-900">
              What needs your attention
            </h2>
            <p className="mt-1 text-[13px] text-stone-500">
              Prioritized actions across pipeline, delivery, and client health.
            </p>
          </div>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600">
            {totalCount} {totalCount === 1 ? 'item' : 'items'}
          </span>
        </div>
      </div>

      <div className="p-5">
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
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50/60 px-4 py-8 text-center">
            <p className="text-sm font-medium text-stone-800">You&rsquo;re caught up.</p>
            <p className="mt-1 text-[13px] text-stone-500">
              {emptyMessage ?? 'No urgent actions right now — check back as activity picks up.'}
            </p>
          </div>
        ) : items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = ICONS[item.type]
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex gap-3 rounded-lg border px-3 py-3 transition-colors duration-150 hover:border-stone-300',
                      PRIORITY_STYLES[item.type],
                    )}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-stone-200/80">
                      <Icon className="h-4 w-4 text-stone-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-stone-900">{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-stone-500">{item.subtitle}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
