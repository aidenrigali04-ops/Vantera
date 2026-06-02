import 'server-only'

import { searchProspects } from '@/lib/aspire/search'
import type { AspireSearchResult } from '@/lib/aspire/types'
import type { OnboardingVertical, PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'

export type { PreviewLead } from '@/lib/onboarding/onboarding-wizard-types'

function toPreviewLead(row: AspireSearchResult): PreviewLead {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    organizationName: row.organizationName,
    city: row.city,
    state: row.state,
    icpScore: row.icpScore,
    icpSignals: row.icpSignals,
    linkedinUrl: row.linkedinUrl,
  }
}

export async function fetchOnboardingPreviewLeads(args: {
  accountId: string
  vertical: OnboardingVertical
  businessName: string
  icpSummary: string
}): Promise<PreviewLead[]> {
  const { results } = await searchProspects(
    args.accountId,
    {
      keywords: [args.businessName, args.icpSummary].filter(Boolean),
    },
    { limit: 5, persist: true },
  )

  return results.slice(0, 5).map(toPreviewLead)
}
