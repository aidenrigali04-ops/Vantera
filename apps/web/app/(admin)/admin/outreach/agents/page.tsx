import { SdrAgentsHubClient } from '@/components/sdr/SdrAgentsHubClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards, getSdrAgentSnapshot } from '@/lib/agents/queries'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function SdrAgentsPage() {
  const session = await requireAdminSession()

  const [account, agents, snapshot] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    getSdrAgentCards(session.accountId),
    getSdrAgentSnapshot(session.accountId),
  ])

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
        enrolledLeads={snapshot.enrolledLeads}
        sdrEnabled={sdrEnabled}
      />
    </Suspense>
  )
}
