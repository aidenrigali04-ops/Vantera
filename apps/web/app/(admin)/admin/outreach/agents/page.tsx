import { AgentsHubView } from '@/components/agents/vantera-os/AgentsHubView'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards } from '@/lib/agents/queries'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount, getSdrActivityFeed } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function SdrAgentsPage() {
  const session = await requireAdminSession()

  const [account, agents, sdrConfigRow] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    getSdrAgentCards(session.accountId),
    findSdrConfigByAccount(session.accountId),
  ])

  let activity: Awaited<ReturnType<typeof getSdrActivityFeed>> = []
  if (sdrConfigRow) {
    try {
      activity = await getSdrActivityFeed(session.accountId)
    } catch (error) {
      console.error('[agents] activity feed failed:', error)
    }
  }

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-[var(--text-secondary)]">Loading agents…</div>}
    >
      <AgentsHubView agents={agents} activity={activity} sdrEnabled={sdrEnabled} />
    </Suspense>
  )
}
