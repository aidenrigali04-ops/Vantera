'use client'

import { IconTile } from '@/components/shared/IconTile'
import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import type { SdrAgentCard, SdrAgentSnapshot } from '@/lib/agents/types'
import { getPipelineStage } from '@/components/agents/VisionAgentCard'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react'
import Link from 'next/link'

type Props = {
  agents: SdrAgentCard[]
  snapshot?: SdrAgentSnapshot
}

const EMPTY_SNAPSHOT: SdrAgentSnapshot = {
  activeCampaigns: 0, draftCampaigns: 0, activeSavedSearches: 0,
  pendingDrafts: 0, pendingEmailDrafts: 0, pendingLinkedInDrafts: 0,
  leadsInPipeline: 0, enrolledLeads: 0,
  prospectScoutConfigured: false, prospectScoutActive: false,
  outreachAgentConfigured: false, outreachAgentActive: false,
  linkedActiveCampaigns: 0, automaticOutreach: false, autoScoutActiveCampaigns: 0,
}

export function DashboardAgentPanel({ agents, snapshot = EMPTY_SNAPSHOT }: Props) {
  const active = agents.filter((a) => a.status === 'active').length
  const noAgents = agents.length === 0

  return (
    <motion.div variants={fadeUp} className="vision-panel-card flex flex-col rounded-2xl">
      {/* header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="flex items-center gap-2">
          <IconTile icon={Bot} size="xs" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">SDR Agents</h3>
        </div>
        <Link
          href="/admin/sdr-agents"
          className="text-[11px] font-medium text-[var(--accent-solid)] hover:text-[var(--accent)] transition-colors"
        >
          Manage →
        </Link>
      </div>

      <div className="flex-1 px-5 py-4">
        {noAgents ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="icon-tile mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
              <Bot className="h-5 w-5 text-[var(--text-secondary)]" strokeWidth={1.75} />
            </div>
            <p className="text-[13px] font-medium text-[var(--text-primary)]">No agents yet</p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              Deploy an SDR agent to automate prospecting.
            </p>
            <Link
              href="/admin/sdr-agents"
              className="vision-cta-btn mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-[var(--text-inverse)] transition-opacity hover:opacity-90"
            >
              <Zap className="h-3.5 w-3.5" />
              Deploy agent
            </Link>
          </div>
        ) : (
          <>
            {/* summary pills */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Total', value: agents.length, icon: Bot, color: '#829ab1' },
                { label: 'Running', value: active, icon: CheckCircle2, color: '#22a558' },
                { label: 'Setup needed', value: agents.filter((a) => a.status === 'needs_setup').length, icon: Clock, color: '#f3a847' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="flex flex-col items-center rounded-xl py-2.5"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                >
                  <Icon className="h-4 w-4 mb-1" style={{ color }} />
                  <span className="text-[18px] font-bold text-[var(--text-primary)]">{value}</span>
                  <span className="text-[10px] text-[var(--text-disabled)]">{label}</span>
                </div>
              ))}
            </div>

            {/* agent list */}
            <ul className="space-y-2">
              {agents.slice(0, 3).map((agent) => {
                const stage = getPipelineStage(agent, snapshot)
                return (
                  <li key={agent.id}>
                    <Link
                      href="/admin/outreach/agents"
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[rgba(0,0,0,0.04)]"
                    >
                      <span className="icon-tile flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <Bot className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                          {agent.name || 'SDR Agent'}
                        </p>
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)]">
                          <span
                            className={cn('h-1.5 w-1.5 rounded-full', stage.dot, stage.pulse && 'animate-pulse')}
                          />
                          {stage.label}
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-disabled)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </motion.div>
  )
}
