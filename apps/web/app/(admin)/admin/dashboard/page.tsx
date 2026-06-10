import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards } from '@/lib/agents/queries'
import { getSdrDashboardStats } from '@/lib/sdr/queries'
import {
  buildRevenueSeries,
  buildStageBreakdown,
  buildWelcomeUpdates,
  type DashboardPanels,
} from '@/lib/dashboard/panels'
import { storedEnrichmentMetrics } from '@/lib/aspire/lead-display'
import {
  findLeads,
  getLeadCreationTimeline,
  getLeadPipelineStats,
} from '@/lib/leads/queries'
import { getRevenueProgress } from '@/lib/revenue/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { redirect } from 'next/navigation'
import { DashboardClient } from './dashboard-client'
import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await requireAdminSession()

  // Onboarding gate is DB-authoritative on the session's own account — never
  // trust middleware branding headers here (host/tenant bleed was letting
  // brand-new accounts skip the wizard and land on the dashboard). Every new
  // owner runs the full signup/onboarding flow until onboarding_completed_at
  // is actually set.
  if (session.role === 'owner') {
    const onboardingComplete = await isOnboardingCompleteForAccount(session.accountId)
    if (!onboardingComplete) {
      redirect(AUTH_ONBOARDING_PATH)
    }
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
    leads: recentLeads.map((lead) => {
      const metrics = storedEnrichmentMetrics(lead.enrichment)
      return {
        id: lead.id,
        name:
          [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
          lead.email ||
          lead.company,
        company: lead.company,
        title: lead.title,
        status: lead.relationshipStatus,
        score: lead.score,
        qualityTier: metrics?.enrichmentTier ?? null,
        channels: {
          email: Boolean(lead.email),
          phone: Boolean(lead.phone),
          linkedin: Boolean(lead.linkedinUrl),
        },
      }
    }),
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
      onboardingIncomplete={false}
      sdrAgents={sdrAgents}
      revenueProgress={revenueProgress}
    />
  )
}
