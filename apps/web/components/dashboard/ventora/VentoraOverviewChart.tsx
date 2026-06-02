'use client'

import type { VentoraMonthlyPoint } from '@/lib/dashboard/ventora-types'
import { MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Props = {
  data: VentoraMonthlyPoint[]
  highlightMonth?: string
}

export function VentoraOverviewChart({ data, highlightMonth = 'Jul' }: Props) {
  const [activeMonth, setActiveMonth] = useState<string | null>(highlightMonth)

  const chartData = useMemo(
    () => data.map((d) => ({ ...d, total: d.solid + d.hatch })),
    [data],
  )

  const active = chartData.find((d) => d.month === (activeMonth ?? highlightMonth))

  return (
    <section className="card-surface flex h-full min-h-[280px] flex-col p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Overview</h2>
        <button type="button" aria-label="Overview options" className="icon-btn">
          <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="relative min-h-[220px] flex-1">
        {active && activeMonth ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-md bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium tracking-wide text-[var(--text-inverse)] shadow-md"
            role="status"
          >
            Conversion {active.solid}
          </div>
        ) : null}

        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 28, right: 4, left: -20, bottom: 0 }}
            barCategoryGap="18%"
            onMouseLeave={() => setActiveMonth(highlightMonth)}
          >
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
              fill="var(--accent-hatch)"
              radius={[0, 0, 0, 0]}
              onMouseEnter={(_, index) => setActiveMonth(chartData[index]?.month ?? null)}
            />
            <Bar
              dataKey="solid"
              stackId="a"
              fill="var(--accent-solid)"
              radius={[2, 2, 0, 0]}
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
    </section>
  )
}
