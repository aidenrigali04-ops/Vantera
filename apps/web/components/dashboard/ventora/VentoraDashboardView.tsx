'use client'

import { VentoraAiOverview } from '@/components/dashboard/ventora/VentoraAiOverview'
import { VentoraCampaignsTable } from '@/components/dashboard/ventora/VentoraCampaignsTable'
import { VentoraMetricCards } from '@/components/dashboard/ventora/VentoraMetricCards'
import { VentoraOverviewChart } from '@/components/dashboard/ventora/VentoraOverviewChart'
import { VentoraPageChrome } from '@/components/dashboard/ventora/VentoraPageChrome'
import { SdrAgentsPromo } from '@/components/dashboard/SdrAgentsPromo'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import { DashboardActionFeed } from '@/app/(admin)/admin/dashboard/DashboardActionFeed'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { fadeUp, staggerContainer } from '@/lib/motion'
import { motion } from 'framer-motion'

type Props = {
  ventora: VentoraDashboardPayload
  email: string
  actionFeed: ActionFeedItem[]
  sdrAgents: SdrAgentCard[]
  showCleanSlate: boolean
  showDemoGuide: boolean
  successNotice: OnboardingSuccessNotice | null
  onDismissSuccessNotice: () => void
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function DashboardSections({
  ventora,
  actionFeed,
  sdrAgents,
  successNotice,
  onDismissSuccessNotice,
}: Pick<
  Props,
  | 'ventora'
  | 'actionFeed'
  | 'sdrAgents'
  | 'successNotice'
  | 'onDismissSuccessNotice'
>) {
  return (
    <>
      {sdrAgents.length > 0 ? (
        <motion.div variants={fadeUp}>
          <SdrAgentsPromo agents={sdrAgents} />
        </motion.div>
      ) : null}

      {actionFeed.length > 0 || successNotice ? (
        <motion.div variants={fadeUp}>
          <DashboardActionFeed
            items={actionFeed}
            successNotice={successNotice}
            onDismissSuccessNotice={onDismissSuccessNotice}
            maxVisible={4}
          />
        </motion.div>
      ) : null}

      <VentoraMetricCards metrics={ventora.metrics} />

      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VentoraOverviewChart
            data={ventora.chartData}
            highlightMonth={ventora.highlightMonth}
          />
        </div>
        <VentoraAiOverview
          headline={ventora.aiHeadline}
          body={ventora.aiBody}
          progress={ventora.aiProgress}
        />
      </motion.div>

      <VentoraCampaignsTable groups={ventora.campaignGroups} />
    </>
  )
}

export function VentoraDashboardView({
  ventora,
  email,
  actionFeed,
  sdrAgents,
  showCleanSlate,
  showDemoGuide,
  successNotice,
  onDismissSuccessNotice,
}: Props) {
  const subtitle = showCleanSlate
    ? 'Add your first client or campaign to get started.'
    : `Good to see you, ${firstNameFromEmail(email)} — conversion, pipeline, and outreach in one place.`

  if (showCleanSlate) {
    return (
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <VentoraPageChrome subtitle={subtitle} />
        <motion.div variants={fadeUp}>
          <CleanSlateWelcome />
        </motion.div>
        <DashboardSections
          ventora={ventora}
          actionFeed={actionFeed}
          sdrAgents={sdrAgents}
          successNotice={successNotice}
          onDismissSuccessNotice={onDismissSuccessNotice}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      <VentoraPageChrome subtitle={subtitle} />
      <DashboardSections
        ventora={ventora}
        actionFeed={actionFeed}
        sdrAgents={sdrAgents}
        successNotice={successNotice}
        onDismissSuccessNotice={onDismissSuccessNotice}
      />
    </motion.div>
  )
}
