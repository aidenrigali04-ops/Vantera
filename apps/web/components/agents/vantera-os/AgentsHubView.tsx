'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import type { SdrAgentCard, SdrAgentId } from '@/lib/agents/types'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronRight,
  PenLine,
  PhoneOutgoing,
  Search,
  Send,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

type Props = {
  agents: SdrAgentCard[]
  activity: SDRActivityEvent[]
  sdrEnabled: boolean
}

/** Figma card order/naming mapped onto the real agents. */
const FIGMA_CARDS: { id: SdrAgentId; title: string; icon: LucideIcon }[] = [
  { id: 'prospect_scout', title: 'Scouting Agent', icon: Search },
  { id: 'outreach_agent', title: 'Messaging Agent', icon: Send },
  { id: 'message_drafter', title: 'Copywrite Agent', icon: PenLine },
]

const EVENT_LABELS: Record<string, string> = {
  lead_enrolled: 'Lead enrolled',
  email_sent: 'Email sent',
  sms_sent: 'SMS sent',
  linkedin_sent: 'LinkedIn message sent',
  linkedin_connection_sent: 'LinkedIn invite sent',
  reply_received: 'Reply received',
  meeting_booked: 'Meeting booked',
  draft_created: 'Draft ready for review',
  scout_run: 'Scout run completed',
  sequence_started: 'Sequence started',
  sequence_completed: 'Sequence completed',
}

function eventLabel(event: SDRActivityEvent): string {
  const base =
    EVENT_LABELS[event.eventType] ??
    event.eventType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return event.leadName ? `${base} — ${event.leadName}` : base
}

function AgentCard({ card, agent }: { card: (typeof FIGMA_CARDS)[number]; agent?: SdrAgentCard }) {
  const Icon = card.icon
  const needsSetup = agent?.status === 'needs_setup'
  const href = agent?.href ?? '/admin/outreach/agents/setup'

  return (
    <motion.article
      variants={fadeUp}
      className="vantera-agent-card flex items-center gap-4 rounded-2xl p-5"
    >
      <Icon className="h-8 w-8 shrink-0 text-[var(--text-primary)]" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[18px] font-semibold text-[var(--text-primary)]">{card.title}</h3>
        {agent ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)]">
            {agent.statLabel}: {agent.statValue}
          </p>
        ) : null}
      </div>
      <Link
        href={href}
        className="vision-cta-btn inline-flex shrink-0 items-center justify-center rounded-2xl border border-white/85 px-6 py-3 text-[15px] font-semibold text-white transition-colors"
      >
        {needsSetup ? 'Set Up' : 'Open'}
      </Link>
    </motion.article>
  )
}

function CallingAgentCard() {
  return (
    <motion.article
      variants={fadeUp}
      className="vantera-agent-card flex items-center gap-4 rounded-2xl p-5 opacity-70"
    >
      <PhoneOutgoing className="h-8 w-8 shrink-0 text-[#f5f6f6]" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[18px] font-semibold text-[var(--text-primary)]">Calling Agent</h3>
        <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">AI cold calls</p>
      </div>
      <span className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] px-6 py-3 text-[15px] font-semibold text-[var(--text-tertiary)] dark:border-white/30">
        Soon
      </span>
    </motion.article>
  )
}

function ActivityRow({ event }: { event: SDRActivityEvent }) {
  const inner = (
    <>
      <Check
        className="h-4 w-4 shrink-0 text-[var(--text-primary)] group-hover:text-white dark:text-white"
        strokeWidth={2.25}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--text-primary)] group-hover:text-white dark:text-white">
        {eventLabel(event)}
      </span>
      {event.company ? (
        <span className="shrink-0 truncate text-[13px] text-[var(--text-tertiary)] group-hover:text-white/80">
          {event.company}
        </span>
      ) : null}
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-disabled)] group-hover:text-white"
        aria-hidden
      />
    </>
  )

  const className =
    'group flex items-center gap-3 rounded-[18px] border border-[var(--border-strong)] px-4 py-3 transition-colors hover:border-white/45 hover:bg-[var(--accent)] dark:border-white/80'

  if (event.leadId) {
    return (
      <Link href={`/admin/leads/${event.leadId}`} className={className}>
        {inner}
      </Link>
    )
  }
  return <div className={className}>{inner}</div>
}

/** Figma Agents screen — agent cards panel + Agent Overview activity panel. */
export function AgentsHubView({ agents, activity, sdrEnabled }: Props) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]))
  const analyst = byId.get('pipeline_analyst')
  const rows = activity.slice(0, 7)

  return (
    <AdminPageContent>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2"
      >
        {/* ── Left panel: agent cards ── */}
        <motion.section variants={fadeUp} className="vantera-glass-panel rounded-2xl p-6">
          {!sdrEnabled && (
            <p className="mb-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-muted)] px-4 py-2.5 text-[12px] text-[var(--text-secondary)]">
              The SDR agent isn&rsquo;t enabled on this workspace yet — contact support to turn it
              on.
            </p>
          )}

          <div className="flex flex-col gap-5">
            {FIGMA_CARDS.map((card) => (
              <AgentCard key={card.id} card={card} agent={byId.get(card.id)} />
            ))}
            <CallingAgentCard />
          </div>

          {analyst ? (
            <Link
              href={analyst.href}
              className="group mt-5 inline-flex items-center gap-1.5 px-1 text-[12px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
            >
              Pipeline Analyst — {analyst.tagline.toLowerCase()}
              <ArrowRight
                className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : null}
        </motion.section>

        {/* ── Right panel: Agent Overview ── */}
        <motion.section variants={fadeUp} className="vantera-glass-panel rounded-2xl p-6">
          <h2 className="pb-5 pt-1 text-center text-[20px] font-semibold text-[var(--text-primary)]">
            Agent Overview
          </h2>

          <div className="vantera-overview-list rounded-[24px] p-3">
            {rows.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-[13px] text-[var(--text-tertiary)]">
                  Agent activity lands here once your agents start running.
                </p>
                <Link
                  href="/admin/outreach/agents/setup"
                  className="vision-cta-btn rounded-full px-4 py-2 text-[12px] font-semibold text-white"
                >
                  Set up Scouting Agent
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rows.map((event) => (
                  <ActivityRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </motion.section>
      </motion.div>
    </AdminPageContent>
  )
}
