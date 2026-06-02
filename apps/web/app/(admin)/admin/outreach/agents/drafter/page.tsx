import { MessageDrafterCommandCenterClient } from '@/components/message-drafter/MessageDrafterCommandCenterClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { getMessageDrafterPayload } from '@/lib/message-drafter/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function MessageDrafterPage() {
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

  if (!sdrEnabled) {
    redirect('/admin/outreach/agents/setup')
  }

  const payload = await getMessageDrafterPayload(session.accountId)

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Loading message drafter…</div>
      }
    >
      <MessageDrafterCommandCenterClient initialPayload={payload} />
    </Suspense>
  )
}
