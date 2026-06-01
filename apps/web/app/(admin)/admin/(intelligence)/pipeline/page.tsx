import { PipelinePageClient } from '@/app/(admin)/admin/(intelligence)/pipeline/PipelinePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads, getLeadPipelineStats } from '@/lib/leads/queries'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const session = await requireAdminSession()

  const [initialLeads, stats, onboardingComplete] = await Promise.all([
    findLeads(session.accountId, { limit: 50 }),
    getLeadPipelineStats(session.accountId),
    session.role === 'owner'
      ? isOnboardingCompleteForAccount(session.accountId)
      : Promise.resolve(true),
  ])

  return (
    <PipelinePageClient
      initialLeads={initialLeads}
      stats={stats}
      accountId={session.accountId}
      setupMode={session.role === 'owner' && !onboardingComplete}
    />
  )
}
