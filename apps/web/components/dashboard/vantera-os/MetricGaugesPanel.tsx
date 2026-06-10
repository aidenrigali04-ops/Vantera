'use client'

import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'

type Props = {
  replyRate: number
  closeRate: number
  revenueProgress: RevenueProgress
}

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${Math.round(n).toLocaleString()}`

/** Figma metric ring — blue gradient arc with rounded caps on a dark track. */
function RingGauge({ pct, id }: { pct: number; id: string }) {
  const size = 116
  const stroke = 13
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const safe = Math.min(100, Math.max(0, pct))
  const dashOffset = circ - (circ * safe) / 100

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rotate-[-90deg]"
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth={stroke}
      />
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="100%" stopColor="#5ac8ff" />
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

function Gauge({
  label,
  pct,
  caption,
  gradientId,
}: {
  label: string
  pct: number | null
  caption: string
  gradientId: string
}) {
  return (
    <div className="flex flex-col items-center sm:items-start">
      <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{label}</h3>
      <div className="relative mt-5 flex h-[116px] w-[116px] items-center justify-center self-center">
        <RingGauge pct={pct ?? 0} id={gradientId} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[20px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
            {pct == null ? '—' : `${pct}%`}
          </span>
        </div>
      </div>
      <p className="mt-4 self-center text-[11px] text-[var(--text-disabled)]">{caption}</p>
    </div>
  )
}

/** Figma: Reply rate / Close Rate / Revenue-goal panel with ring gauges. */
export function MetricGaugesPanel({ replyRate, closeRate, revenueProgress }: Props) {
  const hasGoal = revenueProgress.goal != null && revenueProgress.goal > 0

  return (
    <motion.section
      variants={fadeUp}
      className="vision-panel-card grid grid-cols-1 gap-8 rounded-3xl p-6 sm:grid-cols-3"
    >
      <Gauge
        label="Reply rate"
        pct={replyRate}
        caption="last 30 days"
        gradientId="gauge-reply"
      />
      <Gauge
        label="Close rate"
        pct={closeRate}
        caption="won across all leads"
        gradientId="gauge-close"
      />
      <Gauge
        label="Revenue goal"
        pct={hasGoal ? revenueProgress.pct : null}
        caption={
          hasGoal
            ? `${money(revenueProgress.currentMrr)} of ${money(revenueProgress.goal ?? 0)}`
            : 'set a goal to track progress'
        }
        gradientId="gauge-revenue"
      />
    </motion.section>
  )
}
