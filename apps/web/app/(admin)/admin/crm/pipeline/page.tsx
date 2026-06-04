import { PipelinePageClient } from '@/app/(admin)/admin/(intelligence)/pipeline/PipelinePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads, getLeadPipelineStats } from '@/lib/leads/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function CrmPipelinePage() {
  const session = await requireAdminSession()

  const [initialLeads, stats, onboardingComplete, [account], config] = await Promise.all([
    findLeads(session.accountId, { limit: 50 }),
    getLeadPipelineStats(session.accountId),
    session.role === 'owner'
      ? isOnboardingCompleteForAccount(session.accountId)
      : Promise.resolve(true),
    db
      .select({ plan: accounts.plan })
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
    <PipelinePageClient
      initialLeads={initialLeads}
      stats={stats}
      accountId={session.accountId}
      setupMode={session.role === 'owner' && !onboardingComplete}
      sdrMode={sdrMode}
    />
  )
}
