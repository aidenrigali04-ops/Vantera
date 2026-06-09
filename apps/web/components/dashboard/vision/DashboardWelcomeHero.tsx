'use client'

import { motion } from 'framer-motion'
import { fadeUp } from '@/lib/motion'
import { useBranding } from '@/lib/branding/context'
import type { SdrAgentCard } from '@/lib/agents/types'
import { ArrowRight, Bot, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Props = {
  email: string
  sdrAgents: SdrAgentCard[]
}

function firstName(email: string) {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function DashboardWelcomeHero({ email, sdrAgents }: Props) {
  const { businessName } = useBranding()
  const name = firstName(email)
  const workspace = businessName?.trim() || 'your workspace'
  const activeAgents = sdrAgents.filter((a) => a.status === 'active').length
  const needsSetup = sdrAgents.length === 0 || sdrAgents.some((a) => a.status === 'needs_setup')

  return (
    <motion.div
      variants={fadeUp}
      className="vision-welcome-card relative overflow-hidden rounded-2xl p-6"
    >
      {/* decorative orb */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, #47a3f3 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-32 w-32 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />

      {/* mesh grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(186,227,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(186,227,255,0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

      <div className="relative">
        {/* greeting */}
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--text-disabled)]">
          Welcome back
        </p>
        <h2 className="mt-1 text-[1.65rem] font-bold leading-tight tracking-[-0.03em] text-[var(--text-secondary)]">
          {name}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-tertiary)]">
          {needsSetup
            ? `${workspace} is ready — launch your SDR agent to start prospecting.`
            : `${activeAgents} agent${activeAgents !== 1 ? 's' : ''} running in ${workspace}. Your pipeline is building.`}
        </p>

        {/* agent status chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {sdrAgents.length === 0 ? (
            <span className="flex items-center gap-1.5 rounded-full bg-[rgba(186,227,255,0.08)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
              <Bot className="h-3 w-3" />
              No agents deployed
            </span>
          ) : (
            sdrAgents.slice(0, 2).map((agent) => (
              <span
                key={agent.id}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium"
                style={{
                  background: agent.status === 'active'
                    ? 'rgba(34,165,88,0.12)'
                    : 'rgba(186,227,255,0.07)',
                  color: agent.status === 'active' ? '#22a558' : 'var(--text-tertiary)',
                }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${agent.status === 'active' ? 'animate-pulse bg-emerald-400' : 'bg-[var(--text-disabled)]'}`} />
                {agent.name || 'SDR Agent'}
              </span>
            ))
          )}
        </div>

        {/* CTA */}
        <div className="mt-5 flex items-center gap-2">
          <Link
            href="/admin/sdr-agents"
            className="vision-cta-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-[#002159] transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {needsSetup ? 'Set up agent' : 'Open agent'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
