import { SdrAgentsPageClient } from '@/app/(admin)/admin/outreach/agents/SdrAgentsPageClient'
import { SdrCommandCenterClient } from '@/components/sdr/SdrCommandCenterClient'
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
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (sdrEnabled) {
    const configRow = await findSdrConfigByAccount(session.accountId)
    if (configRow) {
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

      return (
        <SdrCommandCenterClient
          config={mapConfig(configRow)}
          stats={stats}
          initialActivity={activity}
          upcoming={upcoming}
          autonomousMessaging={autonomousMessaging}
        />
      )
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--accent)]">
          Prospecting agent
        </p>
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
          Set up Prospect Scout
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Configure an autonomous prospecting agent that finds ICP-matched leads and adds them to
          your pipeline on a daily or weekly schedule.
        </p>
        <Button
          asChild
          className="bg-[var(--accent)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
        >
          <Link href="/admin/outreach/agents/setup">Set up in 5 minutes</Link>
        </Button>
      </div>
    )
  }

  const [agents, snapshot] = await Promise.all([
    getSdrAgentCards(session.accountId),
    getSdrAgentSnapshot(session.accountId),
  ])

  return <SdrAgentsPageClient agents={agents} enrolledLeads={snapshot.enrolledLeads} />
}
