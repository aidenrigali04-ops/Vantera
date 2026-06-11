'use client'

import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import Link from 'next/link'

type Props = {
  replyRate: number
  closeRate: number
  totalLeads: number
  revenueProgress: RevenueProgress
}

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n).toLocaleString()}`

/** Compact ring — yellow arc on the themed track. */
function MiniRing({ pct, id }: { pct: number; id: string }) {
  const size = 84
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const safe = Math.min(100, Math.max(0, pct))
  const dashOffset = circ - (circ * safe) / 100

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-track)" strokeWidth={stroke} />
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#eab308" />
        </linearGradient>
      </defs>
      {safe > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      )}
    </svg>
  )
}

function MiniStat({
  label,
  pct,
  caption,
  warmingUp,
  gradientId,
}: {
  label: string
  pct: number
  caption: string
  warmingUp: boolean
  gradientId: string
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[84px] w-[84px] items-center justify-center">
        <MiniRing pct={warmingUp ? 0 : pct} id={gradientId} />
        <span className="absolute inset-0 flex items-center justify-center text-[16px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
          {warmingUp ? '—' : `${pct}%`}
        </span>
      </div>
      <p className="mt-2 text-[12px] font-medium text-[var(--text-secondary)]">{label}</p>
      <p className="text-[11px] text-[var(--text-disabled)]">{warmingUp ? 'warming up' : caption}</p>
    </div>
  )
}

/**
 * Hero panel: progress toward the revenue goal set at onboarding, with the
 * concrete distance left ("N more clients"), plus compact reply/close stats.
 */
export function GoalProgressPanel({ replyRate, closeRate, totalLeads, revenueProgress }: Props) {
  const hasGoal = revenueProgress.goal != null && revenueProgress.goal > 0
  const goal = revenueProgress.goal ?? 0
  const pct = hasGoal ? Math.min(100, Math.max(0, revenueProgress.pct)) : 0
  const remaining = Math.max(0, goal - revenueProgress.currentMrr)
  const avg = revenueProgress.avgValue
  const clientsToGo = avg && avg > 0 ? Math.ceil(remaining / avg) : null
  // Before any outreach exists, 0% rates are noise, not signal.
  const warmingUp = totalLeads === 0

  return (
    <motion.section
      variants={fadeUp}
      className="vision-panel-card flex min-w-0 flex-col gap-6 rounded-3xl p-6 lg:flex-row lg:items-center lg:gap-8"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-medium text-[var(--text-tertiary)]">Revenue goal</h2>

        {hasGoal ? (
          <>
            <p className="mt-2 text-[28px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
              {money(revenueProgress.currentMrr)}
              <span className="ml-1.5 text-[15px] font-medium text-[var(--text-tertiary)]">
                of {money(goal)}/mo
              </span>
            </p>

            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--chart-track)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress toward revenue goal"
            >
              <div
                className="h-full rounded-full bg-[var(--highlight)] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
              {remaining <= 0 ? (
                <span className="font-medium text-[var(--success)]">Goal reached — time to raise it.</span>
              ) : clientsToGo != null ? (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">{money(remaining)}</span> to go —
                  about <span className="font-semibold text-[var(--text-primary)]">{clientsToGo}</span> more{' '}
                  {clientsToGo === 1 ? 'client' : 'clients'} at ~{money(avg ?? 0)}/mo
                </>
              ) : (
                <>
                  <span className="font-semibold text-[var(--text-primary)]">{money(remaining)}</span> to go
                </>
              )}
            </p>
          </>
        ) : (
          <div className="mt-3">
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Set a monthly revenue goal and this panel tracks every won client against it.
            </p>
            <Link
              href="/admin/settings"
              className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              Set your goal
            </Link>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-start justify-center gap-6 lg:gap-8">
        <MiniStat
          label="Reply rate"
          pct={replyRate}
          caption="last 30 days"
          warmingUp={warmingUp}
          gradientId="mini-reply"
        />
        <MiniStat
          label="Close rate"
          pct={closeRate}
          caption="won / all leads"
          warmingUp={warmingUp}
          gradientId="mini-close"
        />
      </div>
    </motion.section>
  )
}
