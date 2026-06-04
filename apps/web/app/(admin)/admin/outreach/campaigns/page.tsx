import { CampaignsPageClient } from '@/app/(admin)/admin/outreach/campaigns/CampaignsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { filterEmailCampaigns, filterLinkedInCampaigns } from '@/lib/outreach/linkedin-hub'
import { findOutreachCampaigns } from '@/lib/outreach/queries'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ channel?: string }>
}

export default async function CampaignsPage({ searchParams }: PageProps) {
  const session = await requireAdminSession()
  const params = await searchParams
  const channel = params.channel === 'linkedin' ? 'linkedin' : 'email'
  const all = await findOutreachCampaigns(session.accountId)
  const campaigns =
    channel === 'linkedin' ? filterLinkedInCampaigns(all) : filterEmailCampaigns(all)

  return <CampaignsPageClient campaigns={campaigns} defaultChannel={channel} />
}
