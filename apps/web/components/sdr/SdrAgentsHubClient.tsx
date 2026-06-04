'use client'

import { AdminPageContent } from '@/components/admin/AdminPageContent'
import { AgentsAutomationSection } from '@/components/sdr/AgentsAutomationSection'
import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import { SdrAgentIcon } from '@/components/agents/SdrAgentIcon'
import {
  countActiveAgents,
  SDR_AGENTS_HEADLINE,
  SDR_AGENTS_SUBHEADLINE,
} from '@/lib/agents/sdr-agents'
import type { SdrAgentCard, SdrAgentId } from '@/lib/agents/types'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { cn } from '@/lib/utils'
import { Bot, ChevronRight, Megaphone, Rocket, Sparkles, Users, Zap } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

const AGENT_ORDER: SdrAgentId[] = [
  'prospect_scout',
  'outreach_agent',
  'message_drafter',
  'pipeline_analyst',
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

export function SdrAgentsHubClient({
  agents,
  enrolledLeads,
  sdrEnabled,
  outreachAutomationMode,
  sdrConfigured,
}: Props) {
  const pathname = usePathname()

  const orderedAgents = AGENT_ORDER.map((id) => agents.find((agent) => agent.id === id)).filter(
    Boolean,
  ) as SdrAgentCard[]

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
      <section className="card-surface overflow-hidden border-[var(--accent-border)] bg-gradient-to-br from-[var(--accent-muted)] via-[var(--bg-surface)] to-[var(--bg-subtle)] p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="inline-flex items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-muted)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-primary)]">
              <Bot className="h-3.5 w-3.5" />
              AI SDR workforce
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)] sm:text-3xl">
              {SDR_AGENTS_HEADLINE}
            </h1>
            <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {SDR_AGENTS_SUBHEADLINE}
            </p>
          </div>
          {!sdrEnabled ? (
            <Button asChild className="bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90">
              <Link href="/admin/outreach/agents/setup">
                <Rocket className="mr-1.5 h-4 w-4" />
                Get started
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <KpiStrip items={kpiItems} className="lg:grid-cols-4" />

      {sdrEnabled && sdrConfigured ? (
        <AgentsAutomationSection
          initialMode={outreachAutomationMode}
          sdrConfigured={sdrConfigured}
        />
      ) : null}

      <PageHeader
        title="Agent roster"
        description="Prospect Scout runs first — configure each agent, then open it for live controls and activity."
      />

      <div className="space-y-3">
        {orderedAgents.map((agent) => {
          const href = agentHref(agent)
          const isScoutOpen = agent.id === 'prospect_scout' && pathname.startsWith('/admin/outreach/agents/scout')
          const isOutreachOpen =
            agent.id === 'outreach_agent' && pathname.startsWith('/admin/outreach/agents/outreach')
          const isDrafterOpen =
            agent.id === 'message_drafter' && pathname.startsWith('/admin/outreach/agents/drafter')

          return (
            <article
              key={agent.id}
              className={cn(
                'card-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between',
                isScoutOpen && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/50',
                isOutreachOpen && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/50',
                isDrafterOpen && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/50',
              )}
            >
              <Link href={href} className="flex min-w-0 flex-1 items-start gap-4 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-primary)]">
                  <SdrAgentIcon name={agent.iconName} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">
                      {agent.name}
                    </h3>
                    <StatusBadge
                      label={STATUS_LABEL[agent.status]}
                      tone={STATUS_TONE[agent.status]}
                    />
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[var(--accent)]">{agent.tagline}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {agent.description}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">
                    {agent.statLabel}:{' '}
                    <span className="font-medium text-[var(--text-primary)]">{agent.statValue}</span>
                  </p>
                </div>
              </Link>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  asChild
                  variant={agent.status === 'needs_setup' ? 'default' : 'outline'}
                  className={cn(
                    agent.status === 'needs_setup' &&
                      'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90',
                  )}
                >
                  <Link href={href}>
                    {agent.status === 'needs_setup' ? 'Configure' : agent.ctaLabel}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      <section className="card-surface bg-[var(--bg-subtle)]/50 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Zap className="h-4 w-4 text-[var(--warning)]" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recommended deploy order</h3>
            <ol className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              <li>1. Set Automatic above (or Manual if you want approval gates)</li>
              <li>2. Configure Prospect Scout → discovery into your pipeline</li>
              <li>3. Drafter personalizes sequences per lead automatically</li>
              <li>4. Outreach Agent launches a campaign per Scout run — check Campaigns for the lead list</li>
            </ol>
          </div>
        </div>
      </section>
    </AdminPageContent>
  )
}
