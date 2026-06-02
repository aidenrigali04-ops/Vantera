import { SdrAspireConfigClient } from '@/components/sdr/SdrAspireConfigClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { getSdrAspireConfig } from '@/lib/sdr/aspire-config'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SdrAspireConfigPage() {
  const session = await requireAdminSession()

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const enabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!enabled) {
    redirect('/admin/outreach/agents')
  }

  const config = await findSdrConfigByAccount(session.accountId)
  if (!config) {
    redirect('/admin/outreach/agents/setup')
  }

  const payload = await getSdrAspireConfig(session.accountId)

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2">
      <SdrAspireConfigClient accountId={session.accountId} initial={payload} />
    </div>
  )
}
