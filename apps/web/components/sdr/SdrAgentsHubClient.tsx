'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { AgentsAutomationSection } from '@/components/sdr/AgentsAutomationSection'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { SdrAgentIcon } from '@/components/agents/SdrAgentIcon'
import { countActiveAgents } from '@/lib/agents/sdr-agents'
import type { SdrAgentCard, SdrAgentId } from '@/lib/agents/types'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import { ArrowRight, Bot, ChevronRight, Megaphone, Sparkles, Users } from 'lucide-react'
import Link from 'next/link'

type Props = {
  agents: SdrAgentCard[]
  enrolledLeads: number
  sdrEnabled: boolean
  outreachAutomationMode: OutreachAutomationMode
  sdrConfigured: boolean
}

const STATUS_TONE = {
  active: 'success',
  inactive: 'warning',
  idle: 'neutral',
  needs_setup: 'warning',
} as const

const STATUS_LABEL = {
  active: 'Active',
  inactive: 'Inactive',
  idle: 'Standby',
  needs_setup: 'Configure',
} as const

/**
 * The agents are a pipeline: each one hands off to the next. Ordered and
 * labeled by the real data flow — find → write → send → score — so the screen
 * mirrors how the work actually moves, not the order things were built.
 */
const PIPELINE: { id: SdrAgentId; stage: string }[] = [
  { id: 'prospect_scout', stage: 'Find' },
  { id: 'message_drafter', stage: 'Write' },
  { id: 'outreach_agent', stage: 'Send' },
  { id: 'pipeline_analyst', stage: 'Score' },
]

function agentHref(agent: SdrAgentCard): string {
  if (agent.id === 'prospect_scout') {
    return agent.status === 'needs_setup'
      ? '/admin/outreach/agents/setup'
      : '/admin/outreach/agents/scout'
  }
  if (agent.id === 'outreach_agent') {
    return agent.status === 'needs_setup'
      ? '/admin/outreach/agents/outreach/setup'
      : '/admin/outreach/agents/outreach'
  }
  if (agent.id === 'message_drafter') {
    return '/admin/outreach/agents/drafter'
  }
  return agent.href
}

function PipelineAgent({
  agent,
  stage,
  step,
  isLast,
}: {
  agent: SdrAgentCard
  stage: string
  step: number
  isLast: boolean
}) {
  const href = agentHref(agent)
  // The agent wants the user when it's unconfigured, or (Drafter) has work waiting.
  const needsYou = agent.status === 'needs_setup'

  return (
    <li className="relative">
      {/* Hand-off connector: this agent feeds the next. */}
      {!isLast ? (
        <span
          aria-hidden
          className="absolute left-[1.625rem] top-[3.75rem] bottom-[-0.75rem] w-px bg-[var(--border-default)]"
        />
      ) : null}

      <article
        className={cn(
          'card-surface relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between',
          needsYou && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/40',
        )}
      >
        <Link href={href} className="flex min-w-0 flex-1 items-start gap-4 text-left">
          <span className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-primary)]">
            <SdrAgentIcon name={agent.iconName} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              Step {step} · {stage}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{agent.name}</h3>
              <StatusBadge label={STATUS_LABEL[agent.status]} tone={STATUS_TONE[agent.status]} />
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
              {agent.description}
            </p>
            <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
              {agent.statLabel}:{' '}
              <span className="font-medium text-[var(--text-primary)]">{agent.statValue}</span>
            </p>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:pl-2">
          <Button
            size="sm"
            asChild
            variant={needsYou ? 'default' : 'outline'}
            className={cn(needsYou && 'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90')}
          >
            <Link href={href}>
              {needsYou ? 'Configure' : agent.ctaLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </article>
    </li>
  )
}

export function SdrAgentsHubClient({
  agents,
  enrolledLeads,
  sdrEnabled,
  outreachAutomationMode,
  sdrConfigured,
}: Props) {
  const byId = new Map(agents.map((a) => [a.id, a]))
  const pipeline = PIPELINE.map((p) => ({ ...p, agent: byId.get(p.id) })).filter(
    (p): p is { id: SdrAgentId; stage: string; agent: SdrAgentCard } => Boolean(p.agent),
  )

  const activeCount = countActiveAgents(agents)

  const kpiItems = [
    { label: 'Agents active', value: activeCount, icon: Bot },
    { label: 'In sequences', value: enrolledLeads, icon: Users },
    {
      label: 'Drafts waiting',
      value: (() => {
        const raw = agents.find((a) => a.id === 'message_drafter')?.statValue ?? '0'
        return raw === '0' ? '—' : raw
      })(),
      icon: Sparkles,
    },
    {
      label: 'Linked campaigns',
      value: (() => {
        const raw = agents.find((a) => a.id === 'outreach_agent')?.statValue ?? '—'
        return raw === '0' || raw === 'Not configured' ? '—' : raw
      })(),
      icon: Megaphone,
    },
  ]

  return (
    <AdminPageContent>
      {/* Returning user: lean header. New user: an onboarding surface that teaches the flow. */}
      {sdrEnabled ? (
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Your AI SDR workforce
          </h1>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Four agents run your pipeline end to end — find, write, send, and score — around the clock.
          </p>
        </div>
      ) : (
        <section className="card-surface p-6 sm:p-8">
          <p className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
            <Bot className="h-3.5 w-3.5" />
            AI SDR workforce
          </p>
          <h1 className="mt-3 max-w-xl text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
            Put your pipeline on autopilot
          </h1>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Deploy four agents that find ICP-matched leads, draft personalized outreach, run the
            sequences, and score who to talk to next — without adding headcount.
          </p>

          {/* The flow, taught once: this is the order to deploy in. */}
          <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-[var(--text-secondary)]">
            {PIPELINE.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <span>
                  <span className="text-[var(--text-tertiary)]">{i + 1}.</span> {p.stage}
                </span>
                {i < PIPELINE.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>

          <Button
            asChild
            className="mt-6 bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
          >
            <Link href="/admin/outreach/agents/setup">
              Get started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </section>
      )}

      {sdrEnabled ? <KpiStrip items={kpiItems} className="lg:grid-cols-4" /> : null}

      {sdrEnabled && sdrConfigured ? (
        <AgentsAutomationSection initialMode={outreachAutomationMode} sdrConfigured={sdrConfigured} />
      ) : null}

      <div className="space-y-4">
        <PageHeader
          title="The pipeline"
          description="Each agent hands off to the next. Configure one, then open it for live controls and activity."
        />

        <ol className="space-y-3">
          {pipeline.map((p, i) => (
            <PipelineAgent
              key={p.id}
              agent={p.agent}
              stage={p.stage}
              step={i + 1}
              isLast={i === pipeline.length - 1}
            />
          ))}
        </ol>
      </div>
    </AdminPageContent>
  )
}
