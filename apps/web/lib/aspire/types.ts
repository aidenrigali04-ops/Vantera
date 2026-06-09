import type { AspireLeadProfile } from '@/lib/aspire/lead-display'
import type { LeadQualityTier } from '@/lib/leads/enrichment'

export interface ProspectSearchFilters {
  jobTitles: string[]
  industries: string[]
  companySizeRanges: string[]
  locations: string[]
  keywords?: string[]
  contactEmailStatus?: string[]
  /** Legacy UI fields — mapped into keywords/company search */
  q?: string
  company?: string
}

/** @deprecated Use ProspectSearchFilters */
export type ApifySearchFilters = ProspectSearchFilters

/** Normalized prospect row from the active lead provider (Explorium). */
export interface ProspectLead {
  id: string
  firstName: string
  lastName: string
  title: string
  email: string | null
  phone: string | null
  linkedinUrl: string | null
  organizationName: string
  organizationId: string | null
  websiteUrl: string | null
  city: string | null
  state: string | null
  employeeCount: number | null
  revenue: number | null
  industry: string | null
  technologies: string[]
  photoUrl: string | null
}

/** @deprecated Use ProspectLead */
export type ApifyLead = ProspectLead

export interface ICPConfig {
  targetTitles: string[]
  targetIndustries: string[]
  targetSizes: [number, number]
  targetRevenue?: [number, number]
  mustHaveEmail: boolean
  mustHavePhone: boolean
  bonusTechnologies?: string[]
}

export interface ICPScoreResult {
  score: number
  breakdown: {
    titleMatch: number
    industryMatch: number
    sizeMatch: number
    contactQuality: number
    techBonus: number
  }
  signals: string[]
}

export interface DraftResult {
  channel: 'email' | 'sms'
  subject?: string
  body: string
  metadata: {
    segmentKey: string
    icpScore: number
    triggers: string[]
  }
}

export interface EnrollResult {
  contactId: string
  recordId: string
  leadId: string
  draftIds: string[]
  icpScore: number
  jobId: string | null
}

/** UI-facing search row — includes ICP score from scoring engine */
export type AspireSearchResult = ProspectLead & {
  icpScore: number
  icpSignals: string[]
  enrichmentScore: number
  enrichmentCompleteness: number
  enrichmentTier: LeadQualityTier
  /** aspire_results.id */
  resultId?: string
  /** aspire_results.status */
  status?: string
  /** aspire_results.enrolled_at */
  enrolledAt?: string | null
  /** Linked CRM lead when enrolled */
  leadId?: string | null
  /** leads.enrichment jsonb when lead is linked */
  leadEnrichment?: Record<string, unknown> | null
  /** lead_profiles row or enrichment.profile fallback */
  leadProfile?: AspireLeadProfile | null
  /** @deprecated use icpScore */
  intentScore: number
  /** @deprecated use organizationName */
  company: string
}

export type ProspectSearchSource = 'apify' | 'stub' | 'demo' | 'explorium'

export type ProspectSearchMeta = {
  source: ProspectSearchSource
  providerConfigured: boolean
  providerError?: string
  /** Total matching records reported by the provider (may exceed returned rows). */
  totalFound?: number
  /** Raw rows from provider dataset before mapping. */
  apifyRowCount?: number
  /** Rows dropped because mapping returned null. */
  unmappedRowCount?: number
  /** True when a second broader run was used to fill volume. */
  retriedBroad?: boolean
}
