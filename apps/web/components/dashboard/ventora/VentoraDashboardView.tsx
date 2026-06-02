'use client'

import { VentoraAiOverview } from '@/components/dashboard/ventora/VentoraAiOverview'
import { VentoraCampaignsTable } from '@/components/dashboard/ventora/VentoraCampaignsTable'
import { VentoraMetricCards } from '@/components/dashboard/ventora/VentoraMetricCards'
import { VentoraOverviewChart } from '@/components/dashboard/ventora/VentoraOverviewChart'
import { SdrAgentsPromo } from '@/components/dashboard/SdrAgentsPromo'
import { CleanSlateWelcome } from '@/components/onboarding/CleanSlateWelcome'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import { DashboardActionFeed } from '@/app/(admin)/admin/dashboard/DashboardActionFeed'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'

type Props = {
  ventora: VentoraDashboardPayload
  email: string
  actionFeed: ActionFeedItem[]
  sdrAgents: SdrAgentCard[]
  showCleanSlate: boolean
  showDemoGuide: boolean
  successNotice: OnboardingSuccessNotice | null
  onDismissSuccessNotice: () => void
  onReviewDraft: (draftId: string) => void
}

function firstNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const first = local.split(/[._+-]/)[0] ?? local
  if (!first) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
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
  onReviewDraft,
}: Props) {
  if (showCleanSlate) {
    return (
      <div className="space-y-6">
        <CleanSlateWelcome />
        <VentoraMetricCards metrics={ventora.metrics} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
        </div>
        <VentoraCampaignsTable groups={ventora.campaignGroups} />
      </div>
    )
  }

  const greeting = showDemoGuide
    ? 'See how Ventora runs your business'
    : `Good to see you, ${firstNameFromEmail(email)}`

  const subline = showDemoGuide
    ? 'Sample data shows what your day looks like — start with priorities, then explore campaigns below.'
    : 'Conversion, pipeline, and outreach in one place — gold highlights are live this month.'

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-[1.75rem]">
          {greeting}
        </h1>
        <p className="max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">{subline}</p>
      </header>

      {sdrAgents.length > 0 ? <SdrAgentsPromo agents={sdrAgents} /> : null}

      {actionFeed.length > 0 || successNotice ? (
        <DashboardActionFeed
          items={actionFeed}
          successNotice={successNotice}
          onDismissSuccessNotice={onDismissSuccessNotice}
          onReviewDraft={onReviewDraft}
          maxVisible={4}
        />
      ) : null}

      <VentoraMetricCards metrics={ventora.metrics} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VentoraOverviewChart data={ventora.chartData} highlightMonth={ventora.highlightMonth} />
        </div>
        <VentoraAiOverview
          headline={ventora.aiHeadline}
          body={ventora.aiBody}
          progress={ventora.aiProgress}
        />
      </div>

      <VentoraCampaignsTable groups={ventora.campaignGroups} />
    </div>
  )
}
