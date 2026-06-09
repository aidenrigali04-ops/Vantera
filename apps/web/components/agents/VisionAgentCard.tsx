'use client'

import { cn } from '@/lib/utils'
import type { SdrAgentCard, SdrAgentId, SdrAgentSnapshot } from '@/lib/agents/types'
import { ArrowRight, Bot, Search, Sparkles, Megaphone, Brain, PenLine } from 'lucide-react'
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
  glow?: string
  pulse?: boolean
}

export function getPipelineStage(agent: SdrAgentCard, snapshot: SdrAgentSnapshot): PipelineStage {
  if (agent.id === 'prospect_scout') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-amber-400' }
    if (agent.status === 'inactive' || agent.status === 'idle') return { label: 'Standby', dot: 'bg-[var(--text-disabled)]' }
    if (snapshot.autoScoutActiveCampaigns > 0) {
      return { label: 'Searching', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.6)', pulse: true }
    }
    if (snapshot.leadsInPipeline > 0) {
      return { label: 'Leads ready', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.6)' }
    }
    return { label: 'Active', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.5)' }
  }

  if (agent.id === 'outreach_agent') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-amber-400' }
    if (agent.status === 'inactive' || agent.status === 'idle') return { label: 'Standby', dot: 'bg-[var(--text-disabled)]' }
    if (snapshot.pendingDrafts > 0) {
      return { label: 'Drafts ready', dot: 'bg-[var(--accent-solid)]', glow: '0 0 8px 2px rgba(71,163,243,0.55)' }
    }
    if (snapshot.linkedActiveCampaigns > 0) {
      return { label: 'Sending', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.6)', pulse: true }
    }
    return { label: 'Active', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.5)' }
  }

  if (agent.id === 'message_drafter') {
    if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-amber-400' }
    if (snapshot.pendingDrafts > 0) {
      return { label: 'Drafting', dot: 'bg-violet-400', glow: '0 0 8px 2px rgba(167,139,250,0.55)', pulse: true }
    }
    return { label: 'Ready', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.5)' }
  }

  if (agent.status === 'needs_setup') return { label: 'Needs setup', dot: 'bg-amber-400' }
  if (agent.status === 'active') return { label: 'Active', dot: 'bg-emerald-400', glow: '0 0 8px 2px rgba(52,211,153,0.5)' }
  return { label: 'Standby', dot: 'bg-[var(--text-disabled)]' }
}

const ICON_MAP: Record<SdrAgentId, React.ElementType> = {
  prospect_scout: Search,
  outreach_agent: Megaphone,
  message_drafter: PenLine,
  pipeline_analyst: Brain,
}

const ICON_BG: Record<SdrAgentId, string> = {
  prospect_scout: 'linear-gradient(135deg, #47a3f3 0%, #bae3ff 100%)',
  outreach_agent: 'linear-gradient(135deg, #63e6be 0%, #12b886 100%)',
  message_drafter: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
  pipeline_analyst: 'linear-gradient(135deg, #f3a847 0%, #e67e22 100%)',
}

const GLOW_COLOR: Record<SdrAgentId, string> = {
  prospect_scout: 'rgba(71,163,243,0.15)',
  outreach_agent: 'rgba(99,230,190,0.15)',
  message_drafter: 'rgba(167,139,250,0.15)',
  pipeline_analyst: 'rgba(243,168,71,0.15)',
}

const ROLE_LABEL: Record<SdrAgentId, string> = {
  prospect_scout: 'Prospect Scout',
  outreach_agent: 'Outreach Agent',
  message_drafter: 'Message Drafter',
  pipeline_analyst: 'Pipeline Analyst',
}

export function VisionAgentCard({ agent, href, snapshot }: Props) {
  const Icon = ICON_MAP[agent.id] ?? Bot
  const iconBg = ICON_BG[agent.id] ?? 'linear-gradient(135deg, #47a3f3 0%, #bae3ff 100%)'
  const glowColor = GLOW_COLOR[agent.id] ?? 'rgba(71,163,243,0.15)'
  const stage = getPipelineStage(agent, snapshot)
  const needsSetup = agent.status === 'needs_setup'

  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]"
    >
      <article className="vision-welcome-card relative overflow-hidden rounded-2xl p-6 transition-all duration-200 hover:border-[rgba(186,227,255,0.18)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]">
        {/* radial glow orb */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full"
          style={{ background: `radial-gradient(circle, ${glowColor.replace('0.15', '0.35')} 0%, transparent 70%)` }}
        />
        {/* grid mesh overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(186,227,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(186,227,255,0.4) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative">
          {/* icon + role label row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md"
                style={{ background: iconBg }}
              >
                <Icon className="h-5 w-5 text-[#002159]" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-disabled)]">
                {ROLE_LABEL[agent.id]}
              </p>
            </div>

            {/* pipeline stage pill */}
            <span className="flex items-center gap-1.5 rounded-full border border-[rgba(186,227,255,0.1)] bg-[rgba(16,42,67,0.8)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  stage.dot,
                  stage.pulse && 'animate-pulse',
                )}
                style={stage.glow ? { boxShadow: stage.glow } : undefined}
              />
              {stage.label}
            </span>
          </div>

          {/* name */}
          <h3 className="mt-4 text-[1.4rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-secondary)]">
            {agent.name}
          </h3>

          {/* description */}
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            {agent.tagline}
          </p>

          {/* stat chip */}
          <div className="mt-4 flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-[rgba(186,227,255,0.07)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
              <span className="text-[var(--text-primary)]">{agent.statValue}</span>
              {agent.statLabel}
            </span>
          </div>

          {/* CTA */}
          <div className="mt-5">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold transition-opacity group-hover:opacity-90',
                needsSetup
                  ? 'vision-cta-btn text-[#002159]'
                  : 'border border-[rgba(186,227,255,0.12)] bg-[rgba(186,227,255,0.06)] text-[var(--text-secondary)] group-hover:bg-[rgba(186,227,255,0.1)]',
              )}
            >
              {needsSetup ? <Sparkles className="h-3.5 w-3.5" /> : null}
              {needsSetup ? 'Set up' : 'Open'}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
