import { CampaignDetailClient } from '@/app/(admin)/admin/outreach/campaigns/[id]/CampaignDetailClient'
import { requireAdminSession } from '@/lib/auth/require-session'
import {
  findCampaignEnrollments,
  findCampaignStepsForCampaign,
  findLeadsForCampaignPicker,
  findOutreachCampaignById,
} from '@/lib/outreach/queries'
import { getCampaignChannelFocus } from '@/lib/outreach/types'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = { params: Promise<{ id: string }> }

export default async function CampaignDetailPage({ params }: PageProps) {
  const session = await requireAdminSession()
  const { id } = await params

  const campaign = await findOutreachCampaignById(session.accountId, id)
  if (!campaign) notFound()

  const [enrollments, leads, campaignSteps] = await Promise.all([
    findCampaignEnrollments(session.accountId, id),
    findLeadsForCampaignPicker(session.accountId),
    findCampaignStepsForCampaign(session.accountId, id),
  ])

  return (
    <CampaignDetailClient
      campaign={campaign}
      enrollments={enrollments}
      leads={leads}
      campaignSteps={campaignSteps}
      channelFocus={getCampaignChannelFocus(campaign.workflow)}
    />
  )
}
