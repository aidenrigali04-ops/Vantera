import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import type { ApolloSearchFilters } from '@/lib/aspire/types'

export function isInteractiveAspireSearch(filters: Partial<ApolloSearchFilters>): boolean {
  return Boolean(
    filters.q?.trim() ||
      filters.company?.trim() ||
      (filters.keywords?.length ?? 0) > 0,
  )
}

/** Merge partial UI/saved-search filters with account ICP defaults before Apify calls. */
export function normalizeApolloFilters(
  vertical: string,
  filters: Partial<ApolloSearchFilters> = {},
  options?: { interactive?: boolean },
): ApolloSearchFilters {
  const interactive = options?.interactive ?? isInteractiveAspireSearch(filters)

  if (interactive) {
    return {
      jobTitles: filters.jobTitles ?? [],
      industries: filters.industries ?? [],
      companySizeRanges: filters.companySizeRanges ?? [],
      locations: filters.locations ?? [],
      keywords: filters.keywords,
      contactEmailStatus: filters.contactEmailStatus,
      q: filters.q?.trim() || undefined,
      company: filters.company?.trim() || undefined,
    }
  }

  const icpConfig = getIcpConfigForVertical(vertical)
  const [minSize, maxSize] = icpConfig.targetSizes

  return {
    jobTitles: filters.jobTitles ?? icpConfig.targetTitles,
    industries: filters.industries ?? icpConfig.targetIndustries,
    companySizeRanges:
      filters.companySizeRanges ?? [`${minSize},${maxSize}`, '1,10', '11,50', '51,200'],
    locations: filters.locations ?? ['united states'],
    keywords: filters.keywords,
    contactEmailStatus: filters.contactEmailStatus ?? ['verified', 'guessed'],
    q: filters.q,
    company: filters.company,
  }
}
