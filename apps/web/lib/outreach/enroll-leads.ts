import { db } from '@/lib/db/client'
import { findLeadsByIds, findOutreachCampaignById } from '@/lib/outreach/queries'
import { parseCampaignMetrics } from '@/lib/outreach/types'
import { outreachCampaignEnrollments, outreachCampaigns } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function enrollLeadsInCampaignCore(
  accountId: string,
  campaignId: string,
  leadIds: string[],
): Promise<{ success: true; enrolled: number } | { success: false; error: string }> {
  if (leadIds.length === 0) return { success: false, error: 'Select at least one lead' }

  const campaign = await findOutreachCampaignById(accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }

  const leads = await findLeadsByIds(accountId, leadIds)
  const validIds = leads
    .filter((lead) => lead.email || lead.phone || lead.linkedinUrl)
    .map((lead) => lead.id)
  if (validIds.length === 0) {
    return {
      success: false,
      error: 'Selected leads need at least an email, phone, or LinkedIn URL',
    }
  }

  const rows = await db
    .insert(outreachCampaignEnrollments)
    .values(
      validIds.map((leadId) => ({
        accountId,
        campaignId,
        leadId,
        status: 'active' as const,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: outreachCampaignEnrollments.id })

  const metrics = parseCampaignMetrics(campaign.metrics)
  metrics.enrolled += rows.length

  await db
    .update(outreachCampaigns)
    .set({ metrics, updatedAt: new Date() })
    .where(eq(outreachCampaigns.id, campaignId))

  return { success: true, enrolled: rows.length }
}
