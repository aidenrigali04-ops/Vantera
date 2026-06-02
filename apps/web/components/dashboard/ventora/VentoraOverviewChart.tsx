'use client'

import type { VentoraMonthlyPoint } from '@/lib/dashboard/ventora-types'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type Props = {
  data: VentoraMonthlyPoint[]
  highlightMonth?: string | null
}

export function VentoraOverviewChart({ data, highlightMonth = null }: Props) {
  const hasData = data.some((point) => point.total > 0)
  const defaultHighlight = highlightMonth ?? data.find((point) => point.total > 0)?.month ?? null
  const [activeMonth, setActiveMonth] = useState<string | null>(defaultHighlight)

  const chartData = useMemo(
    () => data.map((d) => ({ ...d, total: d.total ?? d.solid + d.hatch })),
    [data],
  )

  const hovered = activeMonth ? chartData.find((d) => d.month === activeMonth) : null

  return (
    <motion.section
      className="card-surface flex h-full min-h-[280px] flex-col p-4 sm:p-5"
      variants={fadeUp}
      initial="hidden"
      animate="visible"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Overview</h2>
        <button type="button" aria-label="Overview options" className="icon-btn">
          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      {!hasData ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center px-4 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Lead activity will appear here once prospects are added to your pipeline.
          </p>
        </div>
      ) : (
        <div className="relative min-h-[220px] flex-1">
          {hovered ? (
            <div
              className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium tracking-wide text-[var(--text-inverse)] shadow-md"
              role="status"
            >
              {hovered.total} lead{hovered.total === 1 ? '' : 's'}
            </div>
          ) : null}

          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 28, right: 4, left: -20, bottom: 0 }}
              barCategoryGap="18%"
              onMouseLeave={() => setActiveMonth(defaultHighlight)}
            >
              <defs>
                <pattern
                  id="ventora-bar-hatch"
                  patternUnits="userSpaceOnUse"
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="var(--accent-hatch)" />
                  <rect width="2" height="6" fill="var(--accent-solid)" opacity="0.35" />
                </pattern>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip cursor={false} content={() => null} />
              <Bar
                dataKey="hatch"
                stackId="a"
                fill="url(#ventora-bar-hatch)"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                onMouseEnter={(_, index) => setActiveMonth(chartData[index]?.month ?? null)}
              />
              <Bar
                dataKey="solid"
                stackId="a"
                fill="var(--accent-solid)"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
                onMouseEnter={(_, index) => setActiveMonth(chartData[index]?.month ?? null)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.month}
                    stroke={entry.month === activeMonth ? 'var(--text-primary)' : 'transparent'}
                    strokeWidth={entry.month === activeMonth ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.section>
  )
}
