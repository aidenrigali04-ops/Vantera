import { bulkEnrollFromAspire } from '@/lib/aspire/enroll'
import type { ApolloPersonResult } from '@/lib/aspire/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { enrollLeadsInCampaign } from '@/lib/outreach/actions'

export async function enrollAspireProspectsInCampaign(input: {
  campaignId: string
  people: ApolloPersonResult[]
  searchId?: string
}): Promise<
  | { success: true; data: { enrolled: number; skipped: number; campaignEnrolled: number } }
  | { success: false; error: string }
> {
  await requireAdminSession()

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

  const campaignResult = await enrollLeadsInCampaign(input.campaignId, aspireResult.leadIds)
  if (!campaignResult.success) {
    return { success: false, error: campaignResult.error }
  }

  return {
    success: true,
    data: {
      enrolled: aspireResult.enrolled,
      skipped: aspireResult.skipped,
      campaignEnrolled: campaignResult.data.enrolled,
    },
  }
}
