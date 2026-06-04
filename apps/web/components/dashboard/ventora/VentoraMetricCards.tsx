'use client'

import { AnimatedMetricValue } from '@/components/dashboard/ventora/AnimatedMetricValue'
import type { VentoraMetric, VentoraMetricIcon } from '@/lib/dashboard/ventora-types'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'
import { Calendar, LayoutGrid, Trophy, type LucideIcon } from 'lucide-react'

const ICONS: Record<VentoraMetricIcon, LucideIcon> = {
  trophy: Trophy,
  grid: LayoutGrid,
  calendar: Calendar,
}

type Props = {
  metrics: VentoraMetric[]
}

export function VentoraMetricCards({ metrics }: Props) {
  return (
    <motion.div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {metrics.map(({ label, value, iconName }) => {
        const Icon = ICONS[iconName]
        return (
          <motion.article
            key={label}
            variants={fadeUp}
            className="card-surface flex flex-col gap-3 p-4"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent-muted)] ring-1 ring-[var(--accent-border)]">
              <Icon size={18} className="text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
            </div>
            <div>
              <p className="text-sm text-[var(--text-secondary)]">{label}</p>
              <AnimatedMetricValue
                value={value}
                className="mt-1 block text-xl font-semibold tracking-tight text-[var(--text-primary)] tabular-nums"
              />
            </div>
          </motion.article>
        )
      })}
    </motion.div>
  )
}
