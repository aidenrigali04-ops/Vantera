'use client'

import type { StageSlice } from '@/lib/dashboard/panels'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'

type Props = {
  slices: StageSlice[]
  total: number
}

/** Figma "Leads by vertical" palette — blues stepping down to neutral gray. */
const SLICE_COLORS = ['#0a84ff', '#409cff', '#7dc2ff', '#54545b', '#36363c']

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
        <div className="flex flex-1 items-center justify-center py-12">
          <p className="text-[13px] text-[var(--text-disabled)]">
            Stage breakdown appears once leads enter your pipeline.
          </p>
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
