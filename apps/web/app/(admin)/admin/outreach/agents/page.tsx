import { SdrAgentsHubClient } from '@/components/sdr/SdrAgentsHubClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards, getSdrAgentSnapshot } from '@/lib/agents/queries'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import type { ICPConfig } from '@/lib/aspire/types'
import {
  findSdrConfigByAccount,
  getSdrActivityFeed,
  getSdrDashboardStats,
  getUpcomingSdrSends,
} from '@/lib/sdr/queries'
import type { SDRAgentConfig, SdrOutreachWindow } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { accounts, sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

function mapConfig(row: typeof sdrAgentConfigs.$inferSelect): SDRAgentConfig {
  const contacted = row.totalContacted ?? 0
  const replied = row.totalReplied ?? 0
  const booked = row.totalBooked ?? 0

  return {
    id: row.id,
    accountId: row.accountId,
    agentName: row.agentName,
    agentTitle: row.agentTitle,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    signature: row.signature,
    icpConfig: row.icpConfig as ICPConfig,
    targetVerticals: row.targetVerticals ?? [],
    targetCities: row.targetCities ?? [],
    excludeDomains: row.excludeDomains ?? [],
    searchFrequency: (row.searchFrequency as 'daily' | 'weekly') ?? 'daily',
    outreachDays: row.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
    outreachWindow: (row.outreachWindow as SdrOutreachWindow) ?? DEFAULT_OUTREACH_WINDOW,
    maxNewLeadsDay: row.maxNewLeadsDay,
    maxActiveLeads: row.maxActiveLeads,
    prospectMode: (row.prospectMode ?? 'inline_icp') as SDRAgentConfig['prospectMode'],
    defaultMinIcpScore: row.defaultMinIcpScore ?? 70,
    syncIcpToSavedSearches: row.syncIcpToSavedSearches ?? true,
    isActive: row.isActive,
    isPaused: row.isPaused,
    pausedReason: row.pausedReason,
    stats: {
      totalLeadsFound: row.totalLeadsFound,
      totalContacted: contacted,
      totalReplied: replied,
      totalBooked: booked,
      replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
      bookingRate: replied > 0 ? Math.round((booked / replied) * 100) : 0,
    },
  }
}

export default async function SdrAgentsPage() {
  const session = await requireAdminSession()

  const [account, agents, snapshot, configRow] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    getSdrAgentCards(session.accountId),
    getSdrAgentSnapshot(session.accountId),
    findSdrConfigByAccount(session.accountId),
  ])

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  let scoutDetail = null
  if (configRow && sdrEnabled) {
    const autonomousMessaging = await evaluateFlag({
      accountId: session.accountId,
      plan,
      flagName: 'autonomous_ai_messaging',
    })

    const [stats, activity, upcoming] = await Promise.all([
      getSdrDashboardStats(session.accountId),
      getSdrActivityFeed(session.accountId),
      getUpcomingSdrSends(session.accountId),
    ])

    scoutDetail = {
      config: mapConfig(configRow),
      stats,
      initialActivity: activity,
      upcoming,
      autonomousMessaging,
    }
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading agents…</div>}>
      <SdrAgentsHubClient
        agents={agents}
        enrolledLeads={snapshot.enrolledLeads}
        sdrEnabled={sdrEnabled}
        scoutDetail={scoutDetail}
      />
    </Suspense>
  )
}
