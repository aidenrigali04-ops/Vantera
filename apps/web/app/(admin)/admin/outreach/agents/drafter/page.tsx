import { MessageDrafterAgentWorkspace } from '@/components/agents/workspaces/MessageDrafterAgentWorkspace'
import { serializeForClient } from '@/lib/agents/serialize'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { getMessageDrafterPayload } from '@/lib/message-drafter/queries'
import { getSdrProfile } from '@/lib/sdr/profile'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { normalizeOutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function MessageDrafterPage() {
  const session = await requireAdminSession()

  const [account, sdrConfig, profile] = await Promise.all([
    db
      .select({ plan: accounts.plan })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1),
    findSdrConfigByAccount(session.accountId),
    getSdrProfile(session.accountId),
  ])

  const plan = (account[0]?.plan ?? 'team') as Plan
  const sdrEnabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!sdrEnabled || !sdrConfig) {
    redirect('/admin/outreach/agents/setup')
  }

  const payload = await getMessageDrafterPayload(session.accountId)
  const outreachMode = normalizeOutreachAutomationMode(sdrConfig.outreachAutomationMode)

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--text-secondary)]">Loading message drafter…</div>
      }
    >
      <MessageDrafterAgentWorkspace
        initialPayload={serializeForClient(payload)}
        outreachAutomationMode={outreachMode}
        profile={profile}
      />
    </Suspense>
  )
}
