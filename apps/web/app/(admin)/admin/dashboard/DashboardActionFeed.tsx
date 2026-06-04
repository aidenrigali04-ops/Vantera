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
  FileEdit,
  Link2,
  MessageSquare,
  MousePointer,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

const ICONS = {
  stalled_deal: TrendingDown,
  overdue_task: Clock,
  churn_risk: AlertTriangle,
  reply_detected: MessageSquare,
  lead_activity: MessageSquare,
  aspire_icp_match: Users,
  draft_ready: FileEdit,
  score_increased: TrendingUp,
  email_clicked: MousePointer,
  email_bounced: AlertTriangle,
  high_icp_no_outreach: Zap,
  linkedin_step_ready: Link2,
} as const

const ACCENT_STYLES = {
  stalled_deal: 'border-l-amber-500',
  overdue_task: 'border-l-red-500',
  churn_risk: 'border-l-red-500',
  reply_detected: 'border-l-blue-500',
  lead_activity: 'border-l-stone-400',
  aspire_icp_match: 'border-l-teal-500',
  draft_ready: 'border-l-violet-500',
  score_increased: 'border-l-amber-500',
  email_clicked: 'border-l-teal-500',
  email_bounced: 'border-l-red-500',
  high_icp_no_outreach: 'border-l-amber-500',
  linkedin_step_ready: 'border-l-blue-500',
} as const

type Props = {
  items: ActionFeedItem[]
  className?: string
  emptyMessage?: string
  successNotice?: OnboardingSuccessNotice | null
  onDismissSuccessNotice?: () => void
  maxVisible?: number
}

export function DashboardActionFeed({
  items,
  className,
  emptyMessage,
  successNotice,
  onDismissSuccessNotice,
  maxVisible = 5,
}: Props) {
  const visibleItems = items.slice(0, maxVisible)
  const hiddenCount = Math.max(0, items.length - visibleItems.length)
  const totalCount = items.length + (successNotice ? 1 : 0)
  const showEmpty = items.length === 0 && !successNotice

  return (
    <section className={cn('card-surface overflow-hidden', className)} data-tour="action-feed">
      <div className="border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              Today&rsquo;s priorities
            </h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              The actions that protect revenue, clients, and delivery.
            </p>
          </div>
          {totalCount > 0 ? (
            <span className="rounded-full bg-[var(--bg-overlay)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </span>
          ) : null}
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
          <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-4 py-8 text-center">
            <p className="text-sm font-medium text-[var(--text-primary)]">You&rsquo;re caught up.</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {emptyMessage ?? 'No urgent actions right now — check back as activity picks up.'}
            </p>
          </div>
        ) : visibleItems.length > 0 ? (
          <>
            <ul className="space-y-2">
              {visibleItems.map((item) => {
                const Icon = ICONS[item.type] ?? MessageSquare
                const content = (
                  <>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-50 ring-1 ring-stone-200/80">
                      <Icon className="h-4 w-4 text-stone-600" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-stone-900">{item.title}</p>
                      <p className="mt-0.5 text-[12px] text-stone-500">{item.subtitle}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-300" aria-hidden />
                  </>
                )
                const itemClassName = cn(
                  'flex gap-3 rounded-lg border border-[var(--border-default)] border-l-[3px] bg-[var(--bg-surface)] px-3 py-3 transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
                  ACCENT_STYLES[item.type] ?? 'border-l-stone-400',
                )

                return (
                  <li key={item.id}>
                    <Link href={item.href} className={itemClassName}>
                      {content}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {hiddenCount > 0 ? (
              <p className="mt-3 text-center text-[12px] text-stone-500">
                {hiddenCount} more {hiddenCount === 1 ? 'item' : 'items'} in your workspace — open{' '}
                <Link href="/admin/crm/pipeline" className="font-medium text-stone-700 hover:text-stone-900">
                  pipeline
                </Link>{' '}
                or{' '}
                <Link href="/admin/clients" className="font-medium text-stone-700 hover:text-stone-900">
                  clients
                </Link>{' '}
                to review.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
