'use client'

import { IconTile } from '@/components/shared/IconTile'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import { Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { saveRevenueGoal } from '@/lib/revenue/actions'

type Props = {
  data: RevenueProgress
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const digits = (s: string) => Number(s.replace(/[^0-9.]/g, ''))

/* SVG arc helper — draws a progress ring */
function ArcGauge({ pct }: { pct: number }) {
  const size = 120
  const stroke = 10
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  // clamp 0-100
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
      {/* track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(186,227,255,0.08)"
        strokeWidth={stroke}
      />
      {/* gradient def */}
      <defs>
        <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#47a3f3" />
          <stop offset="100%" stopColor="#bae3ff" />
        </linearGradient>
      </defs>
      {/* progress */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#gauge-grad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

export function DashboardRevenueGauge({ data }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(data.goal == null)
  const [goal, setGoal] = useState(data.goal ? String(data.goal) : '')
  const [avg, setAvg] = useState(data.avgValue ? String(data.avgValue) : '')
  const [pending, start] = useTransition()

  function save() {
    const g = digits(goal)
    if (!g || g <= 0) return
    const a = avg ? digits(avg) : null
    start(async () => {
      await saveRevenueGoal({ mrrGoal: g, avgClientValue: a })
      setEditing(false)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <motion.div variants={fadeUp} className="vision-panel-card flex flex-col rounded-2xl p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconTile icon={Target} size="xs" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Revenue goal</h3>
        </div>
        <p className="mb-4 text-[12px] text-[var(--text-tertiary)]">
          Track MRR progress as your agent wins clients.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-disabled)]">Monthly goal</span>
            <div className="mt-1 flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 focus-within:border-[var(--border-focus)]">
              <span className="text-[var(--text-disabled)]">$</span>
              <input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                inputMode="numeric"
                placeholder="50,000"
                className="w-full bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-disabled)]"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-disabled)]">Avg value / client</span>
            <div className="mt-1 flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 focus-within:border-[var(--border-focus)]">
              <span className="text-[var(--text-disabled)]">$</span>
              <input
                value={avg}
                onChange={(e) => setAvg(e.target.value)}
                inputMode="numeric"
                placeholder="2,500"
                className="w-full bg-transparent px-2 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-disabled)]"
              />
            </div>
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !digits(goal)}
            className="vision-cta-btn flex-1 rounded-xl py-2 text-[12px] font-semibold text-[#002159] disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save goal'}
          </button>
          {data.goal != null && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl px-3 py-2 text-[12px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Cancel
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  const goalNum = data.goal ?? 0
  const remaining = Math.max(0, goalNum - data.currentMrr)
  const clientsToGoal =
    data.avgValue && data.avgValue > 0 ? Math.ceil(remaining / data.avgValue) : null

  return (
    <motion.div variants={fadeUp} className="vision-panel-card flex flex-col rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconTile icon={Target} size="xs" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Revenue goal</h3>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-[var(--text-disabled)] transition-colors hover:text-[var(--accent)]"
        >
          Edit
        </button>
      </div>

      {/* gauge */}
      <div className="relative mx-auto my-2 flex h-[120px] w-[120px] items-center justify-center">
        <ArcGauge pct={data.pct} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold tracking-[-0.03em] text-[var(--text-secondary)]">
            {data.pct}%
          </span>
          <span className="text-[10px] text-[var(--text-disabled)]">of goal</span>
        </div>
      </div>

      {/* numbers */}
      <div className="mt-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[var(--text-disabled)]">Current MRR</span>
          <span className="font-semibold text-[var(--text-primary)]">{money(data.currentMrr)}</span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-[var(--text-disabled)]">Goal</span>
          <span className="font-semibold text-[var(--text-primary)]">{money(goalNum)}</span>
        </div>
        {clientsToGoal != null && remaining > 0 ? (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-disabled)]">Clients needed</span>
            <span className="font-semibold text-[var(--accent-solid)]">{clientsToGoal}</span>
          </div>
        ) : null}
      </div>

      {data.pct >= 100 && (
        <p className="mt-3 text-center text-[12px] font-semibold text-emerald-400">
          🎉 Goal reached!
        </p>
      )}
    </motion.div>
  )
}
