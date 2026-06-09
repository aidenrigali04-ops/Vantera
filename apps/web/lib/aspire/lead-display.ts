import type { LeadProspectEnrichment } from '@/lib/leads/enrichment'
import type { ProspectLead } from '@/lib/aspire/types'

export type AspireLeadProfile = {
  disc: string | null
  awarenessLevel: number | null
  topTriggers: string[]
  primaryFear: string | null
  egoIdentity: string | null
  openingHook: string | null
  doNot: string | null
  profiledAt: string | null
}

export type AspireFirmographics = {
  industry: string | null
  employeeCount: number | null
  revenue: number | null
  technologies: string[]
  websiteUrl: string | null
  city: string | null
  state: string | null
  role: string | null
}

export function parseEnrichmentBlob(
  blob: unknown,
): LeadProspectEnrichment | Record<string, unknown> | null {
  if (!blob || typeof blob !== 'object') return null
  return blob as LeadProspectEnrichment | Record<string, unknown>
}

export function firmographicsFromEnrichment(
  blob: unknown,
): Partial<AspireFirmographics> {
  const e = parseEnrichmentBlob(blob)
  if (!e) return {}

  const industry =
    typeof e.industry === 'string'
      ? e.industry
      : typeof (e as Record<string, unknown>).companyIndustry === 'string'
        ? ((e as Record<string, unknown>).companyIndustry as string)
        : null

  const rawSize =
    (e as LeadProspectEnrichment).employeeCount ??
    (e as Record<string, unknown>).employees ??
    (e as Record<string, unknown>).companySize

  const employeeCount =
    typeof rawSize === 'number'
      ? rawSize
      : typeof rawSize === 'string' && rawSize.trim()
        ? Number.parseInt(rawSize, 10) || null
        : null

  const technologies = Array.isArray((e as LeadProspectEnrichment).technologies)
    ? (e as LeadProspectEnrichment).technologies!.filter(
        (t): t is string => typeof t === 'string',
      )
    : Array.isArray((e as Record<string, unknown>).techStack)
      ? ((e as Record<string, unknown>).techStack as unknown[]).filter(
          (t): t is string => typeof t === 'string',
        )
      : []

  const record = e as Record<string, unknown>

  return {
    industry,
    employeeCount,
    revenue: typeof record.revenue === 'number' ? record.revenue : null,
    technologies,
    websiteUrl: typeof record.websiteUrl === 'string' ? record.websiteUrl : null,
    city: typeof record.city === 'string' ? record.city : null,
    state: typeof record.state === 'string' ? record.state : null,
  }
}

export function mapLeadProfileRow(
  profile: {
    disc: string | null
    awarenessLevel: number | null
    topTriggers: unknown
    primaryFear: string | null
    egoIdentity: string | null
    openingHook: string | null
    doNot: string | null
    profiledAt: Date | string
  } | null | undefined,
): AspireLeadProfile | null {
  if (!profile) return null

  const topTriggers = Array.isArray(profile.topTriggers)
    ? profile.topTriggers.filter((t): t is string => typeof t === 'string')
    : []

  return {
    disc: profile.disc,
    awarenessLevel: profile.awarenessLevel,
    topTriggers,
    primaryFear: profile.primaryFear,
    egoIdentity: profile.egoIdentity,
    openingHook: profile.openingHook,
    doNot: profile.doNot,
    profiledAt:
      profile.profiledAt instanceof Date
        ? profile.profiledAt.toISOString()
        : String(profile.profiledAt),
  }
}

export function profileFromEnrichmentBlob(blob: unknown): AspireLeadProfile | null {
  const e = parseEnrichmentBlob(blob)
  const nested = e && typeof e === 'object' && 'profile' in e ? e.profile : null
  if (!nested || typeof nested !== 'object') return null

  const p = nested as Record<string, unknown>
  if (!p.disc && !p.openingHook) return null

  return {
    disc: typeof p.disc === 'string' ? p.disc : null,
    awarenessLevel: typeof p.awarenessLevel === 'number' ? p.awarenessLevel : null,
    topTriggers: Array.isArray(p.topTriggers)
      ? p.topTriggers.filter((t): t is string => typeof t === 'string')
      : [],
    primaryFear: typeof p.primaryFear === 'string' ? p.primaryFear : null,
    egoIdentity: typeof p.egoIdentity === 'string' ? p.egoIdentity : null,
    openingHook: typeof p.openingHook === 'string' ? p.openingHook : null,
    doNot: typeof p.doNot === 'string' ? p.doNot : null,
    profiledAt: typeof p.profiledAt === 'string' ? p.profiledAt : null,
  }
}

/** Merge Explorium raw row, CRM lead columns, and leads.enrichment firmographics. */
export function mergeProspectLeadFields(input: {
  raw: Record<string, unknown>
  lead?: {
    firstName: string | null
    lastName: string | null
    title: string | null
    company: string
    email: string | null
    phone: string | null
    linkedinUrl: string | null
    avatarUrl: string | null
    enrichment: unknown
  } | null
  apifyId: string | null
  resultId: string
}): ProspectLead {
  const fromEnrichment = input.lead
    ? firmographicsFromEnrichment(input.lead.enrichment)
    : {}

  const fullName = String(
    input.raw.full_name ?? input.raw.fullName ?? input.raw.contact_full_name ?? '',
  )
  const nameParts = fullName.trim().split(/\s+/)
  const splitFirst = nameParts[0] ?? ''
  const splitLast = nameParts.slice(1).join(' ')

  return {
    id: input.apifyId ?? input.resultId,
    firstName: input.lead?.firstName ?? String(input.raw.firstName ?? input.raw.first_name ?? splitFirst),
    lastName: input.lead?.lastName ?? String(input.raw.lastName ?? input.raw.last_name ?? splitLast),
    title: input.lead?.title ?? String(input.raw.title ?? input.raw.job_title ?? ''),
    email: input.lead?.email ?? null,
    phone: input.lead?.phone ?? null,
    linkedinUrl: input.lead?.linkedinUrl ?? null,
    organizationName:
      input.lead?.company ??
      String(input.raw.organizationName ?? input.raw.company_name ?? input.raw.company ?? ''),
    organizationId: typeof input.raw.organizationId === 'string' ? input.raw.organizationId : null,
    websiteUrl:
      fromEnrichment.websiteUrl ??
      (typeof input.raw.websiteUrl === 'string' ? input.raw.websiteUrl : null),
    city: fromEnrichment.city ?? (typeof input.raw.city === 'string' ? input.raw.city : null),
    state: fromEnrichment.state ?? (typeof input.raw.state === 'string' ? input.raw.state : null),
    employeeCount:
      fromEnrichment.employeeCount ??
      (typeof input.raw.employeeCount === 'number' ? input.raw.employeeCount : null),
    revenue:
      fromEnrichment.revenue ?? (typeof input.raw.revenue === 'number' ? input.raw.revenue : null),
    industry:
      fromEnrichment.industry ?? (typeof input.raw.industry === 'string' ? input.raw.industry : null),
    technologies:
      fromEnrichment.technologies && fromEnrichment.technologies.length > 0
        ? fromEnrichment.technologies
        : Array.isArray(input.raw.technologies)
          ? input.raw.technologies.filter((t): t is string => typeof t === 'string')
          : [],
    photoUrl: input.lead?.avatarUrl ?? (typeof input.raw.photoUrl === 'string' ? input.raw.photoUrl : null),
  }
}

export function aspireStatusLabel(status: string): string {
  switch (status) {
    case 'enrolled':
      return 'Enrolled in pipeline'
    case 'added_to_crm':
      return 'In CRM'
    case 'found':
      return 'Discovered'
    case 'skipped':
      return 'Skipped'
    default:
      return status.replace(/_/g, ' ')
  }
}

export function storedEnrichmentMetrics(blob: unknown): {
  enrichmentScore?: number
  enrichmentCompleteness?: number
  enrichmentTier?: LeadProspectEnrichment['qualityTier']
} | null {
  const e = parseEnrichmentBlob(blob) as LeadProspectEnrichment | null
  if (!e) return null
  if (typeof e.enrichmentScore !== 'number') return null
  return {
    enrichmentScore: e.enrichmentScore,
    enrichmentCompleteness: e.completenessPct,
    enrichmentTier: e.qualityTier,
  }
}
