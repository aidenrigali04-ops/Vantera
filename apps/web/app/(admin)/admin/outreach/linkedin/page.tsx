import { LinkedInPageClient } from '@/app/(admin)/admin/outreach/linkedin/LinkedInPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findLeads } from '@/lib/leads/queries'
import { findCampaigns, findLinkedinAccount, getCampaignStats } from '@/lib/linkedin/queries'

export const dynamic = 'force-dynamic'

export default async function LinkedInPage() {
  const session = await requireAdminSession()

  const [campaigns, leads, stats, account] = await Promise.all([
    findCampaigns(session.accountId),
    findLeads(session.accountId, { limit: 30 }),
    getCampaignStats(session.accountId),
    findLinkedinAccount(session.accountId, session.userId),
  ])

  const connectionStatus = account?.extensionConnected ? 'connected' : 'disconnected'

  return (
    <LinkedInPageClient
      campaigns={campaigns}
      leads={leads}
      stats={stats}
      connectionStatus={connectionStatus}
      accountId={session.accountId}
    />
  )
}
