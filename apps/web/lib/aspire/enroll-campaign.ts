import { bulkEnrollFromAspire } from '@/lib/aspire/enroll'
import type { ProspectLead } from '@/lib/aspire/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { enrollLeadsInCampaignCore } from '@/lib/outreach/enroll-leads'

export async function enrollAspireProspectsInCampaign(input: {
  campaignId: string
  people: ProspectLead[]
  searchId?: string
}): Promise<
  | { success: true; data: { enrolled: number; skipped: number; campaignEnrolled: number } }
  | { success: false; error: string }
> {
  const session = await requireAdminSession()

  if (!input.people.length) {
    return { success: false, error: 'Select at least one prospect' }
  }

  const withEmail = input.people.filter((p) => p.email)
  if (withEmail.length === 0) {
    return { success: false, error: 'Selected prospects need email addresses' }
  }

  const aspireResult = await bulkEnrollFromAspire(withEmail, input.searchId ?? '', 'prospect')
  if (aspireResult.leadIds.length === 0) {
    return { success: false, error: 'Could not resolve leads for selected prospects' }
  }

  const campaignResult = await enrollLeadsInCampaignCore(
    session.accountId,
    input.campaignId,
    aspireResult.leadIds,
  )
  if (!campaignResult.success) {
    return { success: false, error: campaignResult.error }
  }

  return {
    success: true,
    data: {
      enrolled: aspireResult.enrolled,
      skipped: aspireResult.skipped,
      campaignEnrolled: campaignResult.enrolled,
    },
  }
}
