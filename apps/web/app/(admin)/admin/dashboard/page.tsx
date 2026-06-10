import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { getSdrAgentCards } from '@/lib/agents/queries'
import { getSdrDashboardStats } from '@/lib/sdr/queries'
import {
  buildRevenueSeries,
  buildStageBreakdown,
  buildWelcomeUpdates,
  type DashboardPanels,
} from '@/lib/dashboard/panels'
import {
  findLeads,
  getLeadCreationTimeline,
  getLeadPipelineStats,
} from '@/lib/leads/queries'
import { getRevenueProgress } from '@/lib/revenue/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  let onboardingIncomplete = false
  if (session.role === 'owner') {
    const brandingMatchesSession =
      !branding.accountId || String(branding.accountId) === String(session.accountId)

    let onboardingComplete = true
    if (brandingMatchesSession && branding.onboardingKnown) {
      onboardingComplete = branding.onboardingComplete
    } else {
      onboardingComplete = await isOnboardingCompleteForAccount(session.accountId)
    }
    onboardingIncomplete = !onboardingComplete
  }

  if (onboardingIncomplete) {
    redirect(AUTH_ONBOARDING_PATH)
  }

  const [sdrAgents, revenueProgress, sdrStats, pipelineStats, recentLeads, timeline] =
    await Promise.all([
      getSdrAgentCards(session.accountId),
      getRevenueProgress(session.accountId),
      getSdrDashboardStats(session.accountId),
      getLeadPipelineStats(session.accountId),
      findLeads(session.accountId, { limit: 5 }),
      getLeadCreationTimeline(session.accountId),
    ])

  const { slices, total } = buildStageBreakdown(pipelineStats.byStatus)
  const wonCount =
    pipelineStats.byStatus.find((row) => row.status === 'won')?.count ?? 0

  const panels: DashboardPanels = {
    replyRate: sdrStats.replyRate30d,
    closeRate:
      pipelineStats.total > 0 ? Math.round((wonCount / pipelineStats.total) * 100) : 0,
    totalLeads: total,
    stageBreakdown: slices,
    leads: recentLeads.map((lead) => ({
      id: lead.id,
      name:
        [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
        lead.email ||
        lead.company,
      company: lead.company,
      title: lead.title,
      status: lead.relationshipStatus,
    })),
    revenueSeries: buildRevenueSeries(timeline, revenueProgress.avgValue),
    updates: buildWelcomeUpdates({
      repliesThisWeek: sdrStats.repliesThisWeek,
      leadsFoundToday: sdrStats.leadsFoundToday,
      meetingsThisWeek: sdrStats.meetingsThisWeek,
      currentMrr: revenueProgress.currentMrr,
    }),
  }

  return (
    <DashboardClient
      email={session.email}
      accountId={session.accountId}
      panels={panels}
      onboardingIncomplete={onboardingIncomplete}
      sdrAgents={sdrAgents}
      revenueProgress={revenueProgress}
    />
  )
}
