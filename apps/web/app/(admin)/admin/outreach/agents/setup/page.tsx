import { SdrAgentSetupFlow } from '@/components/sdr/SdrAgentSetupFlow'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SdrSetupPage() {
  const session = await requireAdminSession()

  const [account] = await db
    .select({ plan: accounts.plan, vertical: accounts.vertical, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  const existing = await findSdrConfigByAccount(session.accountId)
  if (existing) {
    redirect('/admin/outreach/agents')
  }

  return (
    <SdrAgentSetupFlow
      sdrEnabled={sdrEnabled}
      isOwner={session.role === 'owner'}
      plan={plan}
      accountVertical={account?.vertical ?? 'agency'}
      accountName={account?.name ?? 'Your business'}
    />
  )
}
