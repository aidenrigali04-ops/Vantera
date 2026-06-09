import { ProspectScoutAgentWorkspace } from '@/components/agents/workspaces/ProspectScoutAgentWorkspace'
import { ScoutRunList } from '@/components/scout/ScoutRunList'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { serializeForClient } from '@/lib/agents/serialize'
import { mapSdrAgentConfigRow } from '@/lib/sdr/map-agent-config'
import { getSdrAspireConfig } from '@/lib/sdr/aspire-config'
import {
  findSdrConfigByAccount,
  getSdrActivityFeed,
  getSdrDashboardStats,
} from '@/lib/sdr/queries'
import { listScoutRuns } from '@/lib/sdr/scout-queries'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

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
  const [stats, activity, aspirePayload, runs] = await Promise.all([
    getSdrDashboardStats(session.accountId),
    getSdrActivityFeed(session.accountId),
    getSdrAspireConfig(session.accountId),
    listScoutRuns(session.accountId, 5),
  ])

  const serialize = (v: unknown): any => JSON.parse(JSON.stringify(v))

  return (
    <div className="space-y-4">
      <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading scout…</div>}>
        <ProspectScoutAgentWorkspace
          mode="configured"
          accountId={session.accountId}
          accountVertical={config.targetVerticals[0] ?? 'agency'}
          config={serializeForClient(config)}
          aspirePayload={serializeForClient(aspirePayload)}
          stats={stats}
          initialActivity={activity}
        />
      </Suspense>
      {runs.length > 0 ? (
        <div className="px-4 pb-4 sm:px-6">
          <ScoutRunList runs={serialize(runs)} />
        </div>
      ) : null}
    </div>
  )
}
