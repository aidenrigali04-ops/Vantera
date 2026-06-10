import {
  firmographicsFromEnrichment,
  storedEnrichmentMetrics,
} from '@/lib/aspire/lead-display'
import type { LeadQualityTier } from '@/lib/leads/enrichment'
import type { leadProfiles, leads } from '@vantera/db'

export const LEAD_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  connected: 'Connected',
  nurturing: 'Nurturing',
  qualified: 'Qualified',
  discovery_booked: 'Call booked',
  proposal_sent: 'Proposal',
  won: 'Won',
  lost: 'Lost',
}

export const LEAD_STAGE_ORDER = [
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
] as const

/** Serializable, enrichment-aware lead row for data tables. */
export type EnrichedLeadRow = {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  title: string | null
  company: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  location: string | null
  industry: string | null
  employeeCount: number | null
  score: number
  stage: string
  source: string
  qualityTier: LeadQualityTier | null
  enrichmentScore: number | null
  completenessPct: number | null
  disc: string | null
}

type LeadRecord = typeof leads.$inferSelect
type LeadProfileRecord = typeof leadProfiles.$inferSelect

export function buildEnrichedLeadRow(
  lead: LeadRecord,
  profile?: LeadProfileRecord | null,
): EnrichedLeadRow {
  const firmographics = firmographicsFromEnrichment(lead.enrichment)
  const metrics = storedEnrichmentMetrics(lead.enrichment)
  const name =
    [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
    lead.email ||
    lead.company

  const location =
    [firmographics.city, firmographics.state].filter(Boolean).join(', ') || null

  return {
    id: lead.id,
    name,
    firstName: lead.firstName,
    lastName: lead.lastName,
    title: lead.title,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    linkedinUrl: lead.linkedinUrl,
    location,
    industry: firmographics.industry ?? null,
    employeeCount: firmographics.employeeCount ?? null,
    score: lead.score,
    stage: lead.relationshipStatus,
    source: lead.source,
    qualityTier: metrics?.enrichmentTier ?? null,
    enrichmentScore: metrics?.enrichmentScore ?? null,
    completenessPct: metrics?.enrichmentCompleteness ?? null,
    disc: profile?.disc ?? null,
  }
}
