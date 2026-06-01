import { PipelinePageClient } from '@/app/(admin)/admin/(intelligence)/pipeline/PipelinePageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads, getLeadPipelineStats } from '@/lib/leads/queries'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const session = await requireAdminSession()

  const [initialLeads, stats] = await Promise.all([
    findLeads(session.accountId, { limit: 50 }),
    getLeadPipelineStats(session.accountId),
  ])

  return (
    <PipelinePageClient
      initialLeads={initialLeads}
      stats={stats}
      accountId={session.accountId}
    />
  )
}
