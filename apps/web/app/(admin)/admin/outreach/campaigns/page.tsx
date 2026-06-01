import { CampaignsPageClient } from '@/app/(admin)/admin/outreach/campaigns/CampaignsPageClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import { findOutreachCampaigns } from '@/lib/outreach/queries'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const session = await requireAdminSession()
  const campaigns = await findOutreachCampaigns(session.accountId)

  return <CampaignsPageClient campaigns={campaigns} />
}
