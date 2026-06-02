'use client'

import { SdrCommandCenterClient } from '@/components/sdr/SdrCommandCenterClient'
import { SdrOutreachHubTabs } from '@/components/sdr/SdrOutreachHubTabs'
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
import type { SDRActivityEvent, SDRAgentConfig, SDRDashboardStats } from '@/lib/sdr/types'
import { cn } from '@/lib/utils'
import { Bot, ChevronRight, Clock, Rocket, Sparkles, Users, Zap } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

type ScoutDetail = {
  config: SDRAgentConfig
  stats: SDRDashboardStats
  initialActivity: SDRActivityEvent[]
  upcoming: Array<{
    step: { id: string; stepNumber: number; channel: string; scheduledFor: Date }
    firstName: string | null
    lastName: string | null
    company: string
  }>
  autonomousMessaging: boolean
}

type Props = {
  agents: SdrAgentCard[]
  enrolledLeads: number
  sdrEnabled: boolean
  scoutDetail: ScoutDetail | null
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

export function SdrAgentsHubClient({
  agents,
  enrolledLeads,
  sdrEnabled,
  scoutDetail,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedAgent = (searchParams.get('agent') as SdrAgentId | null) ?? null

  const orderedAgents = useMemo(() => {
    const byId = new Map(agents.map((agent) => [agent.id, agent]))
    return AGENT_ORDER.map((id) => byId.get(id)).filter(Boolean) as SdrAgentCard[]
  }, [agents])

  const activeCount = countActiveAgents(agents)

  const kpiItems = [
    { label: 'Agents active', value: activeCount, icon: Bot },
    { label: 'In sequences', value: enrolledLeads, icon: Users },
    {
      label: 'Drafts waiting',
      value: agents.find((a) => a.id === 'message_drafter')?.statValue ?? '0',
      icon: Sparkles,
    },
    { label: 'Always on', value: '24/7', icon: Clock },
  ]

  const openAgent = useCallback(
    (agent: SdrAgentCard) => {
      if (agent.id === 'prospect_scout') {
        if (agent.status === 'needs_setup') {
          router.push('/admin/outreach/agents/setup')
          return
        }
        router.push('/admin/outreach/agents?agent=prospect_scout')
        return
      }
      router.push(agent.href)
    },
    [router],
  )

  const showScoutDetail =
    selectedAgent === 'prospect_scout' && scoutDetail && scoutDetail.config

  return (
    <div className="mx-auto w-full space-y-6 px-4 py-5 md:px-8 md:py-6">
      {sdrEnabled ? <SdrOutreachHubTabs /> : null}

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

      <PageHeader
        title="Agent roster"
        description="Prospect Scout runs first — configure each agent, then open it for live controls and activity."
      />

      <div className="space-y-3">
        {orderedAgents.map((agent) => {
          const isSelected = selectedAgent === agent.id && agent.id === 'prospect_scout'
          return (
            <article
              key={agent.id}
              className={cn(
                'card-surface card-surface-interactive flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between',
                isSelected && 'border-[var(--accent-border)] ring-1 ring-[var(--accent-border)]/50',
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-4">
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
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant={agent.status === 'needs_setup' ? 'default' : 'outline'}
                  className={cn(
                    agent.status === 'needs_setup' &&
                      'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90',
                  )}
                  onClick={() => openAgent(agent)}
                >
                  {agent.status === 'needs_setup' ? 'Configure' : agent.ctaLabel}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      {showScoutDetail ? (
        <section className="space-y-4 border-t border-[var(--border-subtle)] pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {scoutDetail.config.agentName}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Live controls, discovery runs, and activity for Prospect Scout.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/outreach/agents')}
            >
              Back to roster
            </Button>
          </div>
          <SdrCommandCenterClient
            embedded
            config={scoutDetail.config}
            stats={scoutDetail.stats}
            initialActivity={scoutDetail.initialActivity}
            upcoming={scoutDetail.upcoming}
            autonomousMessaging={scoutDetail.autonomousMessaging}
          />
        </section>
      ) : null}

      <section className="card-surface bg-[var(--bg-subtle)]/50 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Zap className="h-4 w-4 text-[var(--warning)]" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recommended deploy order</h3>
            <ol className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              <li>1. Configure Prospect Scout → daily or weekly discovery into your pipeline</li>
              <li>2. Enroll matches → Message Drafter writes personalized outreach</li>
              <li>3. Launch a campaign → Outreach Agent runs your sequence 24/7</li>
              <li>4. Pipeline Analyst scores engagement and surfaces follow-ups</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  )
}
