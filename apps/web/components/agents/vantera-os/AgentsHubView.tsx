'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import type { SdrAgentCard, SdrAgentId } from '@/lib/agents/types'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  PenLine,
  PhoneOutgoing,
  Search,
  Send,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { AgentActivityTimeline } from './AgentActivityTimeline'

type Props = {
  agents: SdrAgentCard[]
  activity: SDRActivityEvent[]
  sdrEnabled: boolean
}

/** The agent chain in working order — Scout feeds Drafter feeds Messenger. */
const AGENT_CHAIN: { id: SdrAgentId; title: string; role: string; icon: LucideIcon }[] = [
  { id: 'prospect_scout', title: 'Scouting Agent', role: 'Finds buyers that match your ideal customer', icon: Search },
  { id: 'message_drafter', title: 'Copywrite Agent', role: 'Writes the outreach in your voice', icon: PenLine },
  { id: 'outreach_agent', title: 'Messaging Agent', role: 'Runs the sequences and books the replies', icon: Send },
]

function AgentCard({
  card,
  agent,
  step,
  startHere,
}: {
  card: (typeof AGENT_CHAIN)[number]
  agent?: SdrAgentCard
  step: number
  startHere: boolean
}) {
  const Icon = card.icon
  const needsSetup = !agent || agent.status === 'needs_setup'
  const active = agent?.status === 'active'
  const href = agent?.href ?? '/admin/outreach/agents/setup'

  return (
    <motion.article
      variants={fadeUp}
      className="relative flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-colors hover:border-[var(--border-strong)]"
    >
      {startHere ? (
        <span className="absolute -top-2 left-4 rounded-full bg-[var(--highlight)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#1d1d1f]">
          Start here
        </span>
      ) : null}

      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-tertiary)]"
        aria-hidden
      >
        {step}
      </span>
      <span
        className="icon-tile flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]"
        aria-hidden
      >
        <Icon className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
            {card.title}
          </h3>
          {active ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
              Active
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">
          {agent && !needsSetup ? `${agent.statLabel}: ${agent.statValue}` : card.role}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--text-inverse)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]"
      >
        {needsSetup ? 'Set up' : 'Open'}
      </Link>
    </motion.article>
  )
}

/** Agents hub — the agent chain in working order + live activity. */
export function AgentsHubView({ agents, activity, sdrEnabled }: Props) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  const analyst = byId.get('pipeline_analyst')
  const rows = activity.slice(0, 7)
  // The first un-configured agent in chain order is the single "start here".
  const startHereId = AGENT_CHAIN.find((card) => {
    const agent = byId.get(card.id)
    return !agent || agent.status === 'needs_setup'
  })?.id

  return (
    <AdminPageContent>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
      >
        {/* ── Left panel: the agent chain ── */}
        <motion.section variants={fadeUp} className="vision-panel-card rounded-3xl p-6">
          <div className="pb-5">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Your agent team</h2>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Three agents, one relay: find buyers, write the outreach, book the replies.
            </p>
          </div>

          {!sdrEnabled && (
            <p className="mb-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
              The SDR agent isn&rsquo;t enabled on this workspace yet — contact support to turn it
              on.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {AGENT_CHAIN.map((card, index) => (
              <AgentCard
                key={card.id}
                card={card}
                agent={byId.get(card.id)}
                step={index + 1}
                startHere={card.id === startHereId}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-2 px-1">
            <p className="inline-flex items-center gap-2 text-[12px] text-[var(--text-tertiary)]">
              <PhoneOutgoing className="h-3.5 w-3.5" aria-hidden />
              Calling Agent — AI cold calls, on the roadmap
            </p>
            {analyst ? (
              <Link
                href={analyst.href}
                className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Pipeline Analyst — {analyst.tagline.toLowerCase()}
                <ArrowRight
                  className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            ) : null}
          </div>
        </motion.section>

        {/* ── Right panel: live activity ── */}
        <motion.section variants={fadeUp} className="vision-panel-card rounded-3xl p-6">
          <div className="pb-5">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Live activity</h2>
            <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
              Every reply, meeting, and scout run, the moment it happens.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] px-6 py-12 text-center">
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Activity lands here as soon as your first agent runs.
              </p>
              <Link
                href="/admin/outreach/agents/setup"
                className="inline-flex h-9 items-center rounded-lg bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                Set up the Scouting Agent
              </Link>
            </div>
          ) : (
            <AgentActivityTimeline events={rows} />
          )}
        </motion.section>
      </motion.div>
    </AdminPageContent>
  )
}
