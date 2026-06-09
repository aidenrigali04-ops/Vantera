'use client'

import { DashboardKpiStrip } from '@/components/dashboard/vision/DashboardKpiStrip'
import { DashboardWelcomeHero } from '@/components/dashboard/vision/DashboardWelcomeHero'
import { DashboardRevenueGauge } from '@/components/dashboard/vision/DashboardRevenueGauge'
import { DashboardPriorityFeed } from '@/components/dashboard/vision/DashboardPriorityFeed'
import { DashboardAgentPanel } from '@/components/dashboard/vision/DashboardAgentPanel'
import { VentoraOverviewChart } from '@/components/dashboard/ventora/VentoraOverviewChart'
import { VentoraCampaignsTable } from '@/components/dashboard/ventora/VentoraCampaignsTable'
import { VentoraAiOverview } from '@/components/dashboard/ventora/VentoraAiOverview'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import type { SdrAgentCard, SdrAgentSnapshot } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'

type Props = {
  ventora: VentoraDashboardPayload
  email: string
  actionFeed: ActionFeedItem[]
  sdrAgents: SdrAgentCard[]
  sdrSnapshot?: SdrAgentSnapshot
  revenueProgress: RevenueProgress
  showCleanSlate: boolean
  showDemoGuide: boolean
  successNotice: OnboardingSuccessNotice | null
  onDismissSuccessNotice: () => void
}

function PageHeader() {
  return (
    <motion.header variants={fadeUp}>
      <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--text-secondary)]">
        Dashboard
      </h1>
    </motion.header>
  )
}

export function VentoraDashboardView({
  ventora,
  email,
  actionFeed,
  sdrAgents,
  sdrSnapshot,
  revenueProgress,
  showCleanSlate,
  successNotice,
  onDismissSuccessNotice,
}: Props) {
  const hasChart = ventora.chartData.length > 0
  const hasCampaigns = ventora.campaignGroups.length > 0

  return (
    <motion.div
      className="space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {/* page title */}
      <PageHeader />

      {/* clean slate onboarding */}
      {showCleanSlate && (
        <motion.div variants={fadeUp}>
          <CleanSlateWelcome />
        </motion.div>
      )}

      {/* ── Row 1: KPI strip ── */}
      <DashboardKpiStrip
        revenueProgress={revenueProgress}
        sdrAgents={sdrAgents}
        actionFeed={actionFeed}
        ventora={ventora}
      />

      {/* ── Row 2: Welcome | Priority feed | Revenue gauge ── */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_2fr_1.5fr]"
      >
        <DashboardWelcomeHero email={email} sdrAgents={sdrAgents} />
        <DashboardPriorityFeed
          items={actionFeed}
          successNotice={successNotice}
          onDismissSuccessNotice={onDismissSuccessNotice}
          maxVisible={6}
        />
        <DashboardRevenueGauge data={revenueProgress} />
      </motion.div>

      {/* ── Row 3: Chart | Agent panel ── */}
      <motion.div
        variants={fadeUp}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]"
      >
        <div className="flex flex-col">
          <VentoraOverviewChart data={ventora.chartData} highlightMonth={ventora.highlightMonth} />
        </div>
        <DashboardAgentPanel agents={sdrAgents} snapshot={sdrSnapshot} />
      </motion.div>

      {/* ── Row 4: AI overview (if present) ── */}
      {ventora.aiHeadline ? (
        <motion.div variants={fadeUp}>
          <VentoraAiOverview
            headline={ventora.aiHeadline}
            body={ventora.aiBody}
            progress={ventora.aiProgress}
          />
        </motion.div>
      ) : null}

      {/* ── Row 5: Campaigns table (if present) ── */}
      {hasCampaigns ? <VentoraCampaignsTable groups={ventora.campaignGroups} /> : null}
    </motion.div>
  )
}
