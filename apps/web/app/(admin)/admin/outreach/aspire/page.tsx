import { AspirePageClient } from '@/app/(admin)/admin/outreach/aspire/AspirePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findSavedSearches } from '@/lib/aspire/queries'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function AspirePage() {
  const session = await requireAdminSession()
  const [savedSearches, [account], config] = await Promise.all([
    findSavedSearches(session.accountId),
    db
      .select({ vertical: accounts.vertical, plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    findSdrConfigByAccount(session.accountId),
  ])

  const plan = (account?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })
  const sdrMode = sdrEnabled && Boolean(config)

  return (
    <AspirePageClient
      savedSearches={savedSearches}
      accountId={session.accountId}
      accountVertical={account?.vertical ?? 'agency'}
      sdrMode={sdrMode}
    />
  )
}
