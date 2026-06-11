'use client'

import { useBranding } from '@/lib/branding/context'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { WelcomeUpdate } from '@/lib/dashboard/panels'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import { ArrowUpRight, Bot } from 'lucide-react'
import Link from 'next/link'

type Props = {
  email: string
  sdrAgents: SdrAgentCard[]
  updates: WelcomeUpdate[]
}

function firstName(email: string) {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

/** Figma: "Welcome Back / Here's Whats New" — blue update chips + agent status card. */
export function WelcomePanel({ email, sdrAgents, updates }: Props) {
  const { businessName } = useBranding()
  const name = firstName(email)
  const workspace = businessName?.trim() || 'your workspace'
  const activeAgents = sdrAgents.filter((a) => a.status === 'active').length
  const needsSetup = sdrAgents.length === 0 || sdrAgents.some((a) => a.status === 'needs_setup')

  return (
    <motion.section
      variants={fadeUp}
      className="vision-welcome-card flex min-w-0 flex-col gap-6 rounded-3xl p-6 sm:flex-row"
    >
      {/* left — greeting + what's new */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
          Welcome back, {name}
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--text-tertiary)]">
          Here&rsquo;s what&rsquo;s new in {workspace}
        </p>

        <div className="mt-5 flex flex-col items-start gap-3">
          {updates.length > 0 ? (
            updates.map((update) => (
              <Link
                key={update.id}
                href={update.href}
                className="vision-cta-btn inline-flex max-w-full items-center rounded-[14px] px-4 py-2.5 text-[13px] font-medium text-white transition-colors"
              >
                <span className="truncate">{update.text}</span>
              </Link>
            ))
          ) : (
            <>
              <span className="inline-flex items-center rounded-[14px] border border-[var(--border-subtle)] px-4 py-2.5 text-[13px] text-[var(--text-tertiary)]">
                No new updates yet
              </span>
              <Link
                href="/admin/sdr-agents"
                className="vision-cta-btn inline-flex items-center rounded-[14px] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors"
              >
                {needsSetup ? 'Launch agent' : 'Open agent'}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* right — agent status card (self-contained dark surface, both themes) */}
      <Link
        href="/admin/agents"
        className="group flex w-full flex-col rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5 sm:w-[170px] sm:shrink-0"
        style={{
          background: 'linear-gradient(165deg, #1c1c21 0%, #0a0a0b 100%)',
          boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-start justify-between">
          <p className="text-[13px] font-semibold leading-snug text-white">
            {needsSetup ? 'Set up your AI agent' : 'AI agents running smoothly'}
          </p>
          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-white/70 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </div>
        <div className="mt-auto pt-8">
          <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Bot className="h-4 w-4 text-white" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="text-[28px] font-bold leading-none text-white">{activeAgents}</p>
          <p className="mt-1.5 text-[12px] font-medium text-white/80">
            {activeAgents === 1 ? 'agent active' : 'agents active'}
          </p>
        </div>
      </Link>
    </motion.section>
  )
}
