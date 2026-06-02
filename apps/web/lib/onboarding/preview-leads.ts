import 'server-only'

import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { stubResults } from '@/lib/aspire/prospect-stubs'
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

function buildOnboardingPreviewStubLeads(args: {
  vertical: OnboardingVertical
  businessName: string
  icpSummary?: string | null
}): PreviewLead[] {
  const icpConfig = getIcpConfigForVertical(args.vertical)
  const keyword = args.icpSummary?.trim() || args.businessName.trim() || 'prospects'

  return stubResults({
    keywords: [keyword],
    company: args.businessName.trim() || undefined,
  })
    .map((person) => {
      const scored = scoreICP(person, icpConfig)
      return toPreviewLead({
        ...person,
        icpScore: scored.score,
        icpSignals: scored.signals,
        intentScore: scored.score,
        company: person.organizationName,
      })
    })
    .sort((a, b) => b.icpScore - a.icpScore)
    .slice(0, 5)
}

/**
 * Onboarding step 2 → 3 preview leads.
 * Tries live Aspire search first; always returns up to 5 leads (stub fallback on any failure).
 */
export async function fetchOnboardingPreviewLeads(args: {
  accountId: string
  vertical: OnboardingVertical
  businessName: string
  icpSummary?: string | null
}): Promise<{ leads: PreviewLead[]; usedStubFallback: boolean }> {
  try {
    const { results } = await searchProspects(args.accountId, {}, { limit: 5, persist: true })
    const leads = results.slice(0, 5).map(toPreviewLead)
    if (leads.length > 0) {
      return { leads, usedStubFallback: false }
    }
  } catch (error) {
    console.error('[fetchOnboardingPreviewLeads] live search failed', error)
  }

  return {
    leads: buildOnboardingPreviewStubLeads(args),
    usedStubFallback: true,
  }
}
