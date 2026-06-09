'use client'

import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import {
  onboardingSuccessHref,
  onboardingSuccessLabel,
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

const ACCENT: Record<string, string> = {
  stalled_deal: '#47a3f3',
  overdue_task: '#ef4444',
  churn_risk: '#ef4444',
  reply_detected: '#47a3f3',
  lead_activity: '#829ab1',
  aspire_icp_match: '#22a558',
  draft_ready: '#a78bfa',
  score_increased: '#47a3f3',
  email_clicked: '#22a558',
  email_bounced: '#ef4444',
  high_icp_no_outreach: '#bae3ff',
  linkedin_step_ready: '#0a66c2',
}

type Props = {
  items: ActionFeedItem[]
  successNotice?: OnboardingSuccessNotice | null
  onDismissSuccessNotice?: () => void
  maxVisible?: number
}

export function DashboardPriorityFeed({
  items,
  successNotice,
  onDismissSuccessNotice,
  maxVisible = 6,
}: Props) {
  const visibleItems = items.slice(0, maxVisible)
  const totalCount = items.length + (successNotice ? 1 : 0)
  const showEmpty = items.length === 0 && !successNotice

  return (
    <motion.div variants={fadeUp} className="vision-panel-card flex flex-col rounded-2xl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Today&rsquo;s priorities
          </h3>
          <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            Revenue-protecting actions
          </p>
        </div>
        {totalCount > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(186,227,255,0.1)] text-[11px] font-bold text-[var(--accent)]">
            {totalCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* success notice */}
        {successNotice && (
          <div className="mb-3 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-emerald-300">
                {onboardingSuccessLabel(successNotice)}
              </p>
              <Link
                href={onboardingSuccessHref(successNotice)}
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                onClick={onDismissSuccessNotice}
              >
                Review workspace <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {onDismissSuccessNotice && (
              <button
                type="button"
                onClick={onDismissSuccessNotice}
                className="text-[11px] text-emerald-500 hover:text-emerald-300"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {showEmpty ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(186,227,255,0.06)]">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">All caught up</p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              No urgent actions — check back as activity picks up.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {visibleItems.map((item) => {
              const Icon = ICONS[item.type as keyof typeof ICONS] ?? MessageSquare
              const accentColor = ACCENT[item.type] ?? '#829ab1'
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[rgba(186,227,255,0.05)]"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `${accentColor}18` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: accentColor }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-tertiary)]">
                        {item.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-disabled)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {items.length > maxVisible && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-3">
          <Link
            href="/admin/leads"
            className="text-[11px] font-medium text-[var(--accent-solid)] hover:text-[var(--accent)]"
          >
            +{items.length - maxVisible} more in pipeline →
          </Link>
        </div>
      )}
    </motion.div>
  )
}
