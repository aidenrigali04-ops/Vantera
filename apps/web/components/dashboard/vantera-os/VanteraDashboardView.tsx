'use client'

import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import { LeadsByStageCard } from './LeadsByStageCard'
import { LeadsPanel } from './LeadsPanel'
import { MetricGaugesPanel } from './MetricGaugesPanel'
import { RevenueTrendCard } from './RevenueTrendCard'
import { WelcomePanel } from './WelcomePanel'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { DashboardPanels } from '@/lib/dashboard/panels'
import { onboardingSuccessLabel, type OnboardingSuccessNotice } from '@/lib/import/fields'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'

type Props = {
  email: string
  sdrAgents: SdrAgentCard[]
  revenueProgress: RevenueProgress
  panels: DashboardPanels
  showCleanSlate: boolean
  successNotice: OnboardingSuccessNotice | null
  onDismissSuccessNotice: () => void
}

/** Vantera OS dashboard — Figma composition: welcome | gauges, revenue | stages, leads. */
export function VanteraDashboardView({
  email,
  sdrAgents,
  revenueProgress,
  panels,
  showCleanSlate,
  successNotice,
  onDismissSuccessNotice,
}: Props) {
  return (
    <motion.div
      className="space-y-4"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {successNotice && (
        <motion.div
          variants={fadeUp}
          className="flex items-center gap-3 rounded-2xl border border-[var(--success)]/25 bg-[var(--success-muted)] px-4 py-3"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden />
          <p className="min-w-0 flex-1 text-[13px] font-medium text-[var(--text-primary)]">
            {onboardingSuccessLabel(successNotice)}
          </p>
          <button
            type="button"
            onClick={onDismissSuccessNotice}
            aria-label="Dismiss"
            className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </motion.div>
      )}

      {showCleanSlate && (
        <motion.div variants={fadeUp}>
          <CleanSlateWelcome />
        </motion.div>
      )}

      {/* ── Row 1: Welcome | metric gauges ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <WelcomePanel email={email} sdrAgents={sdrAgents} />
        <MetricGaugesPanel
          replyRate={panels.replyRate}
          closeRate={panels.closeRate}
          revenueProgress={revenueProgress}
        />
      </div>

      {/* ── Row 2: Revenue trend | leads by stage ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <RevenueTrendCard
          series={panels.revenueSeries}
          currentMrr={revenueProgress.currentMrr}
          hasGoalConfig={revenueProgress.avgValue != null && revenueProgress.avgValue > 0}
        />
        <LeadsByStageCard slices={panels.stageBreakdown} total={panels.totalLeads} />
      </div>

      {/* ── Row 3: Leads ── */}
      <LeadsPanel leads={panels.leads} />
    </motion.div>
  )
}
