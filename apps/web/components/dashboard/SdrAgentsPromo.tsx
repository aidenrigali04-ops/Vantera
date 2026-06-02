'use client'

import {
  countActiveAgents,
  SDR_AGENTS_HEADLINE,
  SDR_AGENTS_SUBHEADLINE,
} from '@/lib/agents/sdr-agents'
import type { SdrAgentCard } from '@/lib/agents/types'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
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
    <motion.section
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'card-surface overflow-hidden border-[var(--accent-border)] bg-gradient-to-r from-[var(--accent-muted)] via-[var(--bg-surface)] to-[var(--bg-subtle)]',
        className,
      )}
      data-tour="sdr-agents-promo"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent)] ring-1 ring-[var(--accent-border)]">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
              {SDR_AGENTS_HEADLINE}
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {SDR_AGENTS_SUBHEADLINE}
            </p>
            <p className="mt-2 text-[12px] font-medium text-[var(--text-primary)]">
              {activeCount} of {agents.length} agents running
              {needsSetup ? ' · finish setup to go fully autonomous' : ''}
            </p>
          </div>
        </div>
        <Link
          href="/admin/outreach/agents"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-[13px] font-medium text-[var(--text-inverse)] transition-colors hover:opacity-90"
        >
          {needsSetup ? 'Deploy agents' : 'Manage agents'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.section>
  )
}
