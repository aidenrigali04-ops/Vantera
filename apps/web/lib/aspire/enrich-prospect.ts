import {
  buildLeadProspectEnrichment,
  type LeadQualityTier,
} from '@/lib/leads/enrichment'
import type { ApifyLead, AspireSearchResult } from '@/lib/aspire/types'

export type ProspectEnrichmentFields = {
  enrichmentScore: number
  enrichmentCompleteness: number
  enrichmentTier: LeadQualityTier
}

export function getProspectEnrichmentFields(
  person: ApifyLead,
  icpScore: number,
  icpSignals: string[],
): ProspectEnrichmentFields {
  const meta = buildLeadProspectEnrichment(person, icpScore, icpSignals, 'aspire')
  return {
    enrichmentScore: meta.enrichmentScore,
    enrichmentCompleteness: meta.completenessPct,
    enrichmentTier: meta.qualityTier,
  }
}

export function toEnrichedAspireSearchResult(
  person: ApifyLead,
  icpScore: number,
  icpSignals: string[],
): AspireSearchResult {
  const enrichment = getProspectEnrichmentFields(person, icpScore, icpSignals)
  return {
    ...person,
    icpScore,
    icpSignals,
    intentScore: icpScore,
    company: person.organizationName,
    ...enrichment,
  }
}
