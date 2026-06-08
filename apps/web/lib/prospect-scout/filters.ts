import type { ProspectSearchFilters } from '@/lib/aspire/types'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'

export function buildScoutApifyFilters(config: SdrConfigRow): ProspectSearchFilters {
  const icp = config.icpConfig as {
    targetTitles?: string[]
    targetIndustries?: string[]
    targetSizes?: [number, number]
  }

  return {
    jobTitles: icp.targetTitles ?? ['Owner', 'CEO', 'Founder', 'President'],
    industries: config.targetVerticals.length
      ? config.targetVerticals
      : (icp.targetIndustries ?? []),
    companySizeRanges: icp.targetSizes
      ? [`${icp.targetSizes[0]},${icp.targetSizes[1]}`]
      : ['1,10', '11,50', '51,200'],
    locations: config.targetCities.length ? config.targetCities : ['united states'],
    contactEmailStatus: undefined,
  }
}
