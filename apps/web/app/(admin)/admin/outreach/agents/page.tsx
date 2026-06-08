import { SdrAgentsHubClient } from '@/components/sdr/SdrAgentsHubClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards, getSdrAgentSnapshot } from '@/lib/agents/queries'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { mapSdrAgentConfigRow } from '@/lib/sdr/map-agent-config'
import { findSdrConfigByAccount, getSdrActivityFeed } from '@/lib/sdr/queries'
import { normalizeOutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function SdrAgentsPage() {
  const session = await requireAdminSession()

  const [account, agents, snapshot, sdrConfigRow] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    getSdrAgentCards(session.accountId),
    getSdrAgentSnapshot(session.accountId),
    findSdrConfigByAccount(session.accountId),
  ])

  const outreachMode = normalizeOutreachAutomationMode(sdrConfigRow?.outreachAutomationMode)
  const config = sdrConfigRow ? mapSdrAgentConfigRow(sdrConfigRow) : null
  const activity = sdrConfigRow
    ? await getSdrActivityFeed(session.accountId)
    : []

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading agents…</div>}>
      <SdrAgentsHubClient
        agents={agents}
        snapshot={snapshot}
        enrolledLeads={snapshot.enrolledLeads}
        sdrEnabled={sdrEnabled}
        outreachAutomationMode={outreachMode}
        sdrConfigured={Boolean(sdrConfigRow)}
        config={config}
        initialActivity={activity}
        accountId={session.accountId}
      />
    </Suspense>
  )
}
