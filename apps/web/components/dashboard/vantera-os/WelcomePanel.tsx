'use client'

import { useBranding } from '@/lib/branding/context'
import type { SdrAgentCard } from '@/lib/agents/types'
import { fadeUp } from '@/lib/motion'
import { motion } from 'framer-motion'
import { ArrowUpRight, Bot } from 'lucide-react'
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

/** Figma: "Welcome Back / Here's Whats New" panel — two blue capsule CTAs + blue feature card. */
export function WelcomePanel({ email, sdrAgents }: Props) {
  const { businessName } = useBranding()
  const name = firstName(email)
  const workspace = businessName?.trim() || 'your workspace'
  const activeAgents = sdrAgents.filter((a) => a.status === 'active').length
  const needsSetup = sdrAgents.length === 0 || sdrAgents.some((a) => a.status === 'needs_setup')

  return (
    <motion.section
      variants={fadeUp}
      className="vision-welcome-card flex flex-col gap-6 rounded-3xl p-6 sm:flex-row"
    >
      {/* left — greeting + CTAs */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--text-primary)]">
          Welcome back, {name}
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--text-tertiary)]">
          Here&rsquo;s what&rsquo;s new in {workspace}
        </p>

        <div className="mt-6 flex flex-col items-start gap-3">
          <Link
            href="/admin/sdr-agents"
            className="vision-cta-btn inline-flex w-44 items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-colors"
          >
            {needsSetup ? 'Launch agent' : 'Open agent'}
          </Link>
          <Link
            href="/admin/leads"
            className="vision-cta-btn inline-flex w-44 items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition-colors"
          >
            Review leads
          </Link>
        </div>
      </div>

      {/* right — blue feature card (agents) */}
      <Link
        href="/admin/agents"
        className="group flex w-full shrink-0 flex-col justify-between rounded-2xl p-4 transition-transform duration-150 hover:-translate-y-0.5 sm:w-[160px]"
        style={{
          background: 'linear-gradient(165deg, #0697ff 0%, #0366ad 100%)',
          boxShadow: '0 8px 24px -8px rgba(6, 151, 255, 0.5)',
        }}
      >
        <div className="flex items-start justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <Bot className="h-4 w-4 text-white" strokeWidth={1.75} aria-hidden />
          </span>
          <ArrowUpRight className="h-4 w-4 text-white/70 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </div>
        <div className="mt-8">
          <p className="text-[28px] font-bold leading-none text-white">{activeAgents}</p>
          <p className="mt-1.5 text-[12px] font-medium text-white/80">
            {activeAgents === 1 ? 'agent active' : 'agents active'}
          </p>
        </div>
      </Link>
    </motion.section>
  )
}
