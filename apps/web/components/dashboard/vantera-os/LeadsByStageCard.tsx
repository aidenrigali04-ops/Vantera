'use client'

import type { StageSlice } from '@/lib/dashboard/panels'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import Link from 'next/link'

type Props = {
  slices: StageSlice[]
  total: number
}

/** Stage palette — yellow lead, monochrome steps. */
const SLICE_COLORS = ['#facc15', '#111113', '#71717a', '#a1a1aa', '#d4d4d8']

function SegmentedDonut({ slices }: { slices: StageSlice[] }) {
  const size = 160
  const stroke = 18
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const gap = slices.length > 1 ? 0.012 * circ : 0

  let offset = 0
  const segments = slices.map((slice, i) => {
    const frac = slice.pct / 100
    const len = Math.max(0, frac * circ - gap)
    const seg = (
      <circle
        key={slice.label}
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
      />
    )
    offset += frac * circ
    return seg
  })

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
        stroke="var(--chart-track)"
        strokeWidth={stroke}
      />
      {segments}
    </svg>
  )
}

/** Figma: "Leads by vertical" chart card — donut + center total + legend. */
export function LeadsByStageCard({ slices, total }: Props) {
  return (
    <motion.section variants={fadeUp} className="vantera-chart-card flex min-w-0 flex-col rounded-3xl p-6">
      <h2 className="text-[13px] font-medium text-[var(--text-tertiary)]">Leads by stage</h2>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-[13px] text-[var(--text-disabled)]">
            Stage breakdown appears once leads enter your pipeline.
          </p>
          <Link
            href="/admin/outreach/agents"
            className="text-[12px] font-medium text-[var(--text-primary)] underline-offset-2 hover:underline"
          >
            Launch your agent to start filling it
          </Link>
        </div>
      ) : (
        <div className="mt-5 flex flex-1 flex-col items-center gap-8 sm:flex-row">
          {/* donut + center stat */}
          <div className="relative flex h-[160px] w-[160px] shrink-0 items-center justify-center">
            <SegmentedDonut slices={slices} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                {total.toLocaleString()}
              </span>
              <span className="text-[11px] text-[var(--text-disabled)]">total leads</span>
            </div>
          </div>

          {/* legend */}
          <ul className="w-full min-w-0 flex-1 space-y-3.5">
            {slices.map((slice, i) => (
              <li key={slice.label} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
                  {slice.label}
                </span>
                <span className="shrink-0 text-[13px] font-medium tabular-nums text-[var(--text-tertiary)]">
                  {slice.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.section>
  )
}
