import { SdrCommandCenterClient } from '@/components/sdr/SdrCommandCenterClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { mapSdrAgentConfigRow } from '@/lib/sdr/map-agent-config'
import {
  findSdrConfigByAccount,
  getSdrActivityFeed,
  getSdrDashboardStats,
  getUpcomingSdrSends,
} from '@/lib/sdr/queries'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

/** Prospect Scout command center — discovery runs, activity feed, and live controls. */
export default async function ProspectScoutPage() {
  const session = await requireAdminSession()

  const [account, configRow] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    findSdrConfigByAccount(session.accountId),
  ])

  if (!configRow) {
    redirect('/admin/outreach/agents/setup')
  }

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!sdrEnabled) {
    redirect('/admin/outreach/agents/setup')
  }

  const config = mapSdrAgentConfigRow(configRow)

  const [stats, activity, upcoming] = await Promise.all([
    getSdrDashboardStats(session.accountId),
    getSdrActivityFeed(session.accountId),
    getUpcomingSdrSends(session.accountId),
  ])

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading scout…</div>}>
      <SdrCommandCenterClient
        config={config}
        stats={stats}
        initialActivity={activity}
        upcoming={upcoming}
      />
    </Suspense>
  )
}
