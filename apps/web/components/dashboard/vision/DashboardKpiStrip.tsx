'use client'

import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '@/lib/motion'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import {
  BarChart2,
  Bot,
  DollarSign,
  TrendingUp,
} from 'lucide-react'

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
  iconBg: string
  iconColor: string
  glowColor: string
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
      iconBg: 'linear-gradient(135deg, #47a3f3 0%, #bae3ff 100%)',
      iconColor: '#002159',
      glowColor: 'rgba(71, 163, 243, 0.18)',
    },
    {
      label: "Today's Actions",
      value: String(actionFeed.length),
      sub: actionFeed.length === 0 ? 'All caught up' : 'items need attention',
      delta: actionFeed.length > 0 ? `+${actionFeed.length}` : undefined,
      positive: false,
      icon: TrendingUp,
      iconBg: 'linear-gradient(135deg, #63e6be 0%, #12b886 100%)',
      iconColor: '#002159',
      glowColor: 'rgba(99, 230, 190, 0.18)',
    },
    {
      label: 'Active Agents',
      value: String(activeAgents),
      sub: `of ${sdrAgents.length} deployed`,
      delta: activeAgents > 0 ? `${activeAgents} running` : undefined,
      positive: activeAgents > 0,
      icon: Bot,
      iconBg: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
      iconColor: '#fff',
      glowColor: 'rgba(167, 139, 250, 0.18)',
    },
    {
      label: 'Campaigns',
      value: String(totalCampaigns || activeCampaigns || 0),
      sub: activeCampaigns > 0 ? `${activeCampaigns} active` : 'No active campaigns',
      delta: activeCampaigns > 0 ? `${activeCampaigns} live` : undefined,
      positive: activeCampaigns > 0,
      icon: BarChart2,
      iconBg: 'linear-gradient(135deg, #f3a847 0%, #e67e22 100%)',
      iconColor: '#002159',
      glowColor: 'rgba(243, 168, 71, 0.18)',
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
            style={{ '--kpi-glow': card.glowColor } as React.CSSProperties}
          >
            {/* glow backdrop */}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
              style={{ background: `radial-gradient(ellipse 80% 60% at 0% 100%, ${card.glowColor}, transparent)` }}
            />

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
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: card.positive
                          ? 'rgba(34,165,88,0.15)'
                          : 'rgba(220,38,38,0.15)',
                        color: card.positive ? '#22a558' : '#dc2626',
                      }}
                    >
                      {card.delta}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-[var(--text-disabled)]">{card.sub}</span>
                </div>
              </div>

              {/* icon */}
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{ background: card.iconBg }}
              >
                <Icon className="h-5 w-5" style={{ color: card.iconColor }} />
              </span>
            </div>
          </motion.article>
        )
      })}
    </motion.div>
  )
}
