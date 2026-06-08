import type { ProspectLead } from '@/lib/aspire/types'

export type LeadQualityTier = 'excellent' | 'strong' | 'moderate' | 'weak'

export type LeadProspectEnrichment = {
  apifyId?: string
  industry?: string | null
  icpSignals?: string[]
  websiteUrl?: string | null
  city?: string | null
  state?: string | null
  employeeCount?: number | null
  revenue?: number | null
  technologies?: string[]
  enrichmentScore: number
  completenessPct: number
  qualityTier: LeadQualityTier
  contactChannels: {
    email: boolean
    phone: boolean
    linkedin: boolean
  }
  enrichedAt: string
  source: 'apify' | 'scout' | 'aspire'
  profile?: {
    disc?: string | null
    awarenessLevel?: number | null
    topTriggers?: string[]
    primaryFear?: string | null
    openingHook?: string | null
    profiledAt?: string
  }
}

export function computeEnrichmentScore(person: ProspectLead): {
  score: number
  completenessPct: number
  contactChannels: LeadProspectEnrichment['contactChannels']
} {
  let points = 0
  const max = 100

  if (person.email) points += 28
  if (person.phone) points += 18
  if (person.linkedinUrl) points += 14
  if (person.title?.trim()) points += 8
  if (person.organizationName?.trim()) points += 8
  if (person.industry?.trim()) points += 6
  if (person.websiteUrl?.trim()) points += 6
  if (person.employeeCount != null) points += 6
  if (person.revenue != null) points += 4
  if (person.city || person.state) points += 4
  if (person.technologies.length > 0) points += 4
  if (person.photoUrl) points += 4

  const filled = [
    person.email,
    person.phone,
    person.linkedinUrl,
    person.title,
    person.organizationName,
    person.industry,
    person.websiteUrl,
    person.employeeCount,
    person.revenue,
    person.city || person.state,
    person.technologies.length > 0 ? 'tech' : null,
    person.photoUrl,
  ].filter(Boolean).length

  return {
    score: Math.min(max, points),
    completenessPct: Math.round((filled / 12) * 100),
    contactChannels: {
      email: Boolean(person.email),
      phone: Boolean(person.phone),
      linkedin: Boolean(person.linkedinUrl),
    },
  }
}

export function qualityTierFromScores(icpScore: number, enrichmentScore: number): LeadQualityTier {
  const composite = Math.round(icpScore * 0.62 + enrichmentScore * 0.38)
  if (composite >= 80) return 'excellent'
  if (composite >= 65) return 'strong'
  if (composite >= 45) return 'moderate'
  return 'weak'
}

export function buildLeadProspectEnrichment(
  person: ProspectLead,
  icpScore: number,
  icpSignals: string[],
  source: LeadProspectEnrichment['source'],
): LeadProspectEnrichment {
  const { score, completenessPct, contactChannels } = computeEnrichmentScore(person)

  return {
    apifyId: person.id,
    industry: person.industry,
    icpSignals,
    websiteUrl: person.websiteUrl,
    city: person.city,
    state: person.state,
    employeeCount: person.employeeCount,
    revenue: person.revenue,
    technologies: person.technologies,
    enrichmentScore: score,
    completenessPct,
    qualityTier: qualityTierFromScores(icpScore, score),
    contactChannels,
    enrichedAt: new Date().toISOString(),
    source,
  }
}

export function mergeLeadEnrichment(
  existing: Record<string, unknown> | null | undefined,
  next: LeadProspectEnrichment,
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' ? { ...existing } : {}
  return { ...base, ...next }
}

export function formatEnrichmentNotes(enrichment: LeadProspectEnrichment): string {
  const lines = [
    `Enrichment (${enrichment.qualityTier}, ${enrichment.completenessPct}% complete)`,
    enrichment.industry ? `Industry: ${enrichment.industry}` : null,
    enrichment.employeeCount != null ? `Employees: ${enrichment.employeeCount}` : null,
    enrichment.revenue != null ? `Revenue: ${enrichment.revenue}` : null,
    enrichment.websiteUrl ? `Website: ${enrichment.websiteUrl}` : null,
    enrichment.technologies?.length
      ? `Tech: ${enrichment.technologies.slice(0, 6).join(', ')}`
      : null,
    enrichment.icpSignals?.length
      ? `ICP signals: ${enrichment.icpSignals.slice(0, 5).join('; ')}`
      : null,
  ].filter(Boolean)

  return lines.join('\n')
}
