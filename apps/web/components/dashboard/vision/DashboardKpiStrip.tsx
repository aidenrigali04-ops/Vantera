'use client'

import { IconTile } from '@/components/shared/IconTile'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '@/lib/motion'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import { BarChart2, Bot, DollarSign, TrendingUp } from 'lucide-react'

type Props = {
  revenueProgress: RevenueProgress
  sdrAgents: SdrAgentCard[]
  actionFeed: ActionFeedItem[]
  ventora: VentoraDashboardPayload
}

type KpiCard = {
  label: string
  value: string
  sub: string
  delta?: string
  positive?: boolean
  icon: React.ElementType
}

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n).toLocaleString()}`

export function DashboardKpiStrip({ revenueProgress, sdrAgents, actionFeed, ventora }: Props) {
  const activeAgents = sdrAgents.filter((a) => a.status === 'active').length
  const totalCampaigns = ventora.campaignGroups.reduce((s, g) => s + g.count, 0)
  const activeCampaigns = ventora.campaignGroups.reduce(
    (s, g) => s + g.rows.filter((r) => r.status === 'active').length,
    0,
  )

  const cards: KpiCard[] = [
    {
      label: 'Current MRR',
      value: money(revenueProgress.currentMrr),
      sub: revenueProgress.goal
        ? `of ${money(revenueProgress.goal)} goal`
        : 'Set a goal to track progress',
      delta: revenueProgress.goal ? `${revenueProgress.pct}%` : undefined,
      positive: (revenueProgress.pct ?? 0) > 0,
      icon: DollarSign,
    },
    {
      label: "Today's Actions",
      value: String(actionFeed.length),
      sub: actionFeed.length === 0 ? 'All caught up' : 'items need attention',
      icon: TrendingUp,
    },
    {
      label: 'Active Agents',
      value: String(activeAgents),
      sub: `of ${sdrAgents.length} deployed`,
      delta: activeAgents > 0 ? `${activeAgents} running` : undefined,
      positive: activeAgents > 0,
      icon: Bot,
    },
    {
      label: 'Campaigns',
      value: String(totalCampaigns || activeCampaigns || 0),
      sub: activeCampaigns > 0 ? `${activeCampaigns} active` : 'No active campaigns',
      delta: activeCampaigns > 0 ? `${activeCampaigns} live` : undefined,
      positive: activeCampaigns > 0,
      icon: BarChart2,
    },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <motion.article
            key={card.label}
            variants={fadeUp}
            className="vision-kpi-card relative overflow-hidden rounded-2xl p-5"
          >
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-disabled)]">
                  {card.label}
                </p>
                <p className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-[var(--text-secondary)]">
                  {card.value}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  {card.delta ? (
                    <span
                      className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]"
                    >
                      {card.delta}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-[var(--text-disabled)]">{card.sub}</span>
                </div>
              </div>

              <IconTile icon={Icon} size="md" />
            </div>
          </motion.article>
        )
      })}
    </motion.div>
  )
}
