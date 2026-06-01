'use client'

import {
  countActiveAgents,
  SDR_AGENTS_HEADLINE,
  SDR_AGENTS_SUBHEADLINE,
} from '@/lib/agents/sdr-agents'
import type { SdrAgentCard } from '@/lib/agents/types'
import { cn } from '@/lib/utils'
import { ArrowRight, Bot } from 'lucide-react'
import Link from 'next/link'

type Props = {
  agents: SdrAgentCard[]
  className?: string
}

export function SdrAgentsPromo({ agents, className }: Props) {
  const activeCount = countActiveAgents(agents)
  const needsSetup = agents.some((agent) => agent.status === 'needs_setup')

  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-violet-200/90 bg-gradient-to-r from-violet-50/90 via-white to-stone-50 shadow-sm ring-1 ring-violet-900/[0.03]',
        className,
      )}
      data-tour="sdr-agents-promo"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-stone-900">
              {SDR_AGENTS_HEADLINE}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-stone-600">
              {SDR_AGENTS_SUBHEADLINE}
            </p>
            <p className="mt-2 text-[12px] font-medium text-violet-800">
              {activeCount} of {agents.length} agents running
              {needsSetup ? ' · finish setup to go fully autonomous' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/admin/outreach/agents"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 text-[13px] font-medium text-white transition-colors hover:bg-stone-800"
        >
          {needsSetup ? 'Deploy agents' : 'Manage agents'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  )
}
