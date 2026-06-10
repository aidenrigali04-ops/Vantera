'use client'

import { IconTile } from '@/components/shared/IconTile'
import { cn } from '@/lib/utils'
import type { SdrAgentCard, SdrAgentId, SdrAgentSnapshot } from '@/lib/agents/types'
import { ArrowRight, Bot, Brain, Megaphone, PenLine, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Props = {
  agent: SdrAgentCard
  href: string
  snapshot: SdrAgentSnapshot
  pipelineLabel?: string
}

type PipelineStage = {
  label: string
  dot: string
  pulse?: boolean
}

export function getPipelineStage(agent: SdrAgentCard, snapshot: SdrAgentSnapshot): PipelineStage {
  if (agent.id === 'prospect_scout') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-[var(--warning)]' }
    if (agent.status === 'inactive' || agent.status === 'idle') {
      return { label: 'Standby', dot: 'bg-[var(--text-tertiary)]' }
    }
    if (snapshot.autoScoutActiveCampaigns > 0) {
      return { label: 'Searching', dot: 'bg-[var(--success)]', pulse: true }
    }
    if (snapshot.leadsInPipeline > 0) {
      return { label: 'Leads ready', dot: 'bg-[var(--success)]' }
    }
    return { label: 'Active', dot: 'bg-[var(--success)]' }
  }

  if (agent.id === 'outreach_agent') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-[var(--warning)]' }
    if (agent.status === 'inactive' || agent.status === 'idle') {
      return { label: 'Standby', dot: 'bg-[var(--text-tertiary)]' }
    }
    if (snapshot.pendingDrafts > 0) {
      return { label: 'Drafts ready', dot: 'bg-[var(--text-secondary)]' }
    }
    if (snapshot.linkedActiveCampaigns > 0) {
      return { label: 'Sending', dot: 'bg-[var(--success)]', pulse: true }
    }
    return { label: 'Active', dot: 'bg-[var(--success)]' }
  }

  if (agent.id === 'message_drafter') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-[var(--warning)]' }
    if (snapshot.pendingDrafts > 0) {
      return { label: 'Drafting', dot: 'bg-[var(--text-secondary)]', pulse: true }
    }
    return { label: 'Ready', dot: 'bg-[var(--success)]' }
  }

  if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-[var(--warning)]' }
  if (agent.status === 'active') return { label: 'Active', dot: 'bg-[var(--success)]' }
  return { label: 'Standby', dot: 'bg-[var(--text-tertiary)]' }
}

const ICON_MAP: Record<SdrAgentId, React.ElementType> = {
  prospect_scout: Search,
  outreach_agent: Megaphone,
  message_drafter: PenLine,
  pipeline_analyst: Brain,
}

const ROLE_LABEL: Record<SdrAgentId, string> = {
  prospect_scout: 'Prospect Scout',
  outreach_agent: 'Outreach Agent',
  message_drafter: 'Message Drafter',
  pipeline_analyst: 'Pipeline Analyst',
}

export function VisionAgentCard({ agent, href, snapshot }: Props) {
  const Icon = ICON_MAP[agent.id] ?? Bot
  const stage = getPipelineStage(agent, snapshot)
  const needsSetup = agent.status === 'needs_setup'

  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
    >
      <article className="vision-welcome-card relative overflow-hidden rounded-2xl p-6 transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)]">
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IconTile icon={Icon} size="md" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-disabled)]">
                {ROLE_LABEL[agent.id]}
              </p>
            </div>

            <span className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                className={cn('h-2 w-2 rounded-full', stage.dot, stage.pulse && 'animate-pulse')}
                aria-hidden
              />
              {stage.label}
            </span>
          </div>

          <h3 className="mt-4 text-[1.4rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-secondary)]">
            {agent.name}
          </h3>

          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            {agent.tagline}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
              <span className="text-[var(--text-primary)]">{agent.statValue}</span>
              {agent.statLabel}
            </span>
          </div>

          <div className="mt-5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-opacity group-hover:opacity-90',
                needsSetup
                  ? 'vision-cta-btn text-[var(--text-primary)]'
                  : 'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] group-hover:bg-[var(--bg-subtle)]',
              )}
            >
              {needsSetup ? <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
              {needsSetup ? 'Set up' : 'Open'}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
