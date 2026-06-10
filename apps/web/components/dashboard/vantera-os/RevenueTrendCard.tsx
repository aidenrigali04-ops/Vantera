'use client'

import type { RevenuePoint } from '@/lib/dashboard/panels'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Props = {
  series: RevenuePoint[]
  currentMrr: number
  hasGoalConfig: boolean
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const tick = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`)

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

/** Figma Metrics UI Kit: Revenue area chart — blue series over a muted gray series. */
export function RevenueTrendCard({ series, currentMrr, hasGoalConfig }: Props) {
  const hasData = series.some((p) => p.revenue > 0 || p.pipeline > 0)

  return (
    <motion.section
      variants={fadeUp}
      className="vantera-chart-card flex min-h-[300px] min-w-0 flex-col rounded-3xl p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[13px] font-medium text-[var(--text-tertiary)]">Revenue</h2>
          <p className="mt-1 text-[26px] font-bold tracking-[-0.02em] text-[var(--text-primary)]">
            {money(currentMrr)}
          </p>
        </div>
        <div className="flex items-center gap-4 pt-1">
          <LegendDot color="#0a84ff" label="Revenue" />
          <LegendDot color="#6b6b73" label="Pipeline" />
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-[13px] text-[var(--text-disabled)]">
            {hasGoalConfig
              ? 'Revenue builds here as your agent wins clients.'
              : 'Set your revenue goal to start tracking this trend.'}
          </p>
          {!hasGoalConfig && (
            <Link
              href="/admin/settings"
              className="text-[12px] font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              Set goal
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 min-h-[190px] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0a84ff" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#0a84ff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pipeline-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6b6b73" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#6b6b73" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-disabled)', fontSize: 11 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={48}
                tick={{ fill: 'var(--text-disabled)', fontSize: 11 }}
                tickFormatter={tick}
              />
              <Tooltip
                cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                contentStyle={{
                  background: 'var(--bg-overlay)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                formatter={(value: number, name: string) => [
                  money(value),
                  name === 'revenue' ? 'Revenue' : 'Pipeline',
                ]}
              />
              <Area
                type="monotone"
                dataKey="pipeline"
                stroke="#6b6b73"
                strokeWidth={1.5}
                fill="url(#pipeline-fill)"
                isAnimationActive={false}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0a84ff"
                strokeWidth={2}
                fill="url(#revenue-fill)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: '#0a84ff', stroke: '#fff', strokeWidth: 1.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.section>
  )
}
