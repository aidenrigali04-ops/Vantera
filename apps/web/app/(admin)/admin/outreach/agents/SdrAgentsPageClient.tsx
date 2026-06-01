'use client'

import { KpiStrip } from '@/components/operational/KpiStrip'
import { PageHeader } from '@/components/operational/PageHeader'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  countActiveAgents,
  SDR_AGENTS_HEADLINE,
  SDR_AGENTS_SUBHEADLINE,
} from '@/lib/agents/sdr-agents'
import type { SdrAgentCard } from '@/lib/agents/types'
import { ArrowRight, Bot, Clock, Rocket, Sparkles, Users, Zap } from 'lucide-react'
import Link from 'next/link'

type Props = {
  agents: SdrAgentCard[]
  enrolledLeads: number
}

const STATUS_TONE = {
  active: 'success',
  idle: 'neutral',
  needs_setup: 'warning',
} as const

const STATUS_LABEL = {
  active: 'Running',
  idle: 'Standby',
  needs_setup: 'Needs setup',
} as const

export function SdrAgentsPageClient({ agents, enrolledLeads }: Props) {
  const activeCount = countActiveAgents(agents)

  const kpiItems = [
    { label: 'Agents running', value: activeCount, icon: Bot },
    { label: 'In sequences', value: enrolledLeads, icon: Users },
    {
      label: 'Drafts waiting',
      value: agents.find((a) => a.id === 'message_drafter')?.statValue ?? '0',
      icon: Sparkles,
    },
    { label: 'Always on', value: '24/7', icon: Clock },
  ]

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-stone-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
              <Bot className="h-3.5 w-3.5" />
              AI SDR workforce
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-3xl">
              {SDR_AGENTS_HEADLINE}
            </h1>
            <p className="text-[15px] leading-relaxed text-stone-600">{SDR_AGENTS_SUBHEADLINE}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-stone-900 hover:bg-stone-800">
              <Link href="/admin/outreach/aspire">
                <Rocket className="mr-1.5 h-4 w-4" />
                Deploy Prospect Scout
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/outreach/campaigns">
                Launch Outreach Agent
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <KpiStrip items={kpiItems} className="lg:grid-cols-4" />

      <PageHeader
        title="Your agent roster"
        description="Each agent handles one part of outbound — configure them once, then let them run in the background."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => {
          const Icon = agent.icon
          return (
            <article
              key={agent.id}
              className="flex h-full flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                  <Icon className="h-5 w-5" />
                </span>
                <StatusBadge
                  label={STATUS_LABEL[agent.status]}
                  tone={STATUS_TONE[agent.status]}
                />
              </div>

              <div className="mt-4 flex-1">
                <h3 className="text-base font-semibold text-stone-900">{agent.name}</h3>
                <p className="mt-0.5 text-sm font-medium text-violet-700">{agent.tagline}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{agent.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    {agent.statLabel}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-stone-900">{agent.statValue}</p>
                </div>
                <Button asChild size="sm" variant={agent.status === 'needs_setup' ? 'default' : 'outline'}>
                  <Link href={agent.href}>{agent.ctaLabel}</Link>
                </Button>
              </div>
            </article>
          )
        })}
      </div>

      <section className="rounded-xl border border-stone-200 bg-stone-50/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-stone-200">
              <Zap className="h-4 w-4 text-amber-600" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Recommended deploy order</h3>
              <ol className="mt-2 space-y-1 text-sm text-stone-600">
                <li>1. Save an Aspire search → Prospect Scout finds leads weekly</li>
                <li>2. Enroll matches → Message Drafter writes personalized outreach</li>
                <li>3. Launch a campaign → Outreach Agent runs your sequence 24/7</li>
                <li>4. Pipeline Analyst scores engagement and surfaces follow-ups</li>
              </ol>
            </div>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/admin/settings">Configure integrations</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
