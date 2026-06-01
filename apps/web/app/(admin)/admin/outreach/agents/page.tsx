import { SdrAgentsPageClient } from '@/app/(admin)/admin/outreach/agents/SdrAgentsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { getSdrAgentCards, getSdrAgentSnapshot } from '@/lib/agents/queries'

export const dynamic = 'force-dynamic'

export default async function SdrAgentsPage() {
  const session = await requireAdminSession()
  const [agents, snapshot] = await Promise.all([
    getSdrAgentCards(session.accountId),
    getSdrAgentSnapshot(session.accountId),
  ])

  return <SdrAgentsPageClient agents={agents} enrolledLeads={snapshot.enrolledLeads} />
}
