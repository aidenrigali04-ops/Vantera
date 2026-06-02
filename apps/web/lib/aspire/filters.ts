import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { ApolloSearchFilters } from '@/lib/aspire/types'

/** Merge partial UI/saved-search filters with account ICP defaults before Apollo calls. */
export function normalizeApolloFilters(
  vertical: string,
  filters: Partial<ApolloSearchFilters> = {},
): ApolloSearchFilters {
  const icpConfig = getIcpConfigForVertical(vertical)
  const [minSize, maxSize] = icpConfig.targetSizes

  return {
    jobTitles: filters.jobTitles ?? icpConfig.targetTitles,
    industries: filters.industries ?? icpConfig.targetIndustries,
    companySizeRanges:
      filters.companySizeRanges ?? [`${minSize},${maxSize}`, '1,10', '11,50', '51,200'],
    locations: filters.locations ?? ['United States'],
    keywords: filters.keywords,
    contactEmailStatus: filters.contactEmailStatus ?? ['verified', 'guessed'],
    q: filters.q,
    company: filters.company,
  }
}
