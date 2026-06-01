import { SdrSequencesPageClient } from '@/components/sdr/SdrSequencesPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { listSdrSequences } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function SdrSequencesPage() {
  const session = await requireAdminSession()

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const enabled = await evaluateFlag({
    accountId: session.accountId,
    plan: (account?.plan ?? 'team') as Plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!enabled) {
    return (
      <p className="py-12 text-center text-sm text-stone-500">
        SDR Agent module is not enabled for this account.
      </p>
    )
  }

  const rows = await listSdrSequences(session.accountId, { limit: 100 })

  return <SdrSequencesPageClient rows={rows} />
}
