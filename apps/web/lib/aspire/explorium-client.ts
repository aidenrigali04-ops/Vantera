import 'server-only'

import { env } from '@/lib/env'
import type { ProspectLead, ProspectSearchFilters, ICPConfig } from '@/lib/aspire/types'

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

export function isExploriumConfigured(): boolean {
  return Boolean(env.EXPLORIUM_API_KEY?.trim())
}

function apiBase(): string {
  return (env.EXPLORIUM_API_BASE_URL ?? 'https://api.explorium.ai/v1').replace(/\/$/, '')
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    api_key: env.EXPLORIUM_API_KEY ?? '',
  }
}

// ---------------------------------------------------------------------------
// Filter mapping: our ICPConfig + ApifySearchFilters → Explorium filter shape
// ---------------------------------------------------------------------------

const SIZE_RANGE_MAP: Record<string, string[]> = {
  '1,10':    ['1-10'],
  '11,50':   ['11-50'],
  '51,200':  ['51-200'],
  '201,500': ['201-500'],
  '501,1000':['501-1000'],
}

function mapSizeRanges(ranges: string[]): string[] {
  const out = new Set<string>()
  for (const r of ranges) {
    const mapped = SIZE_RANGE_MAP[r]
    if (mapped) {
      mapped.forEach((v) => out.add(v))
    } else {
      // Tolerate free-form "min,max" values by binning them
      const [min] = r.split(',').map(Number)
      if (min != null) {
        if (min <= 10)  out.add('1-10')
        else if (min <= 50)  out.add('11-50')
        else if (min <= 200) out.add('51-200')
        else if (min <= 500) out.add('201-500')
        else out.add('501-1000')
      }
    }
  }
  return [...out]
}

// Map job title strings to Explorium job_level enum values.
// We use job_level (direct-use filter) instead of job_title (requires autocomplete).
function titlesToJobLevels(titles: string[]): string[] {
  const levels = new Set<string>()
  const lower = titles.map((t) => t.toLowerCase())
  for (const t of lower) {
    if (t.includes('owner') || t.includes('founder') || t.includes('co-founder')) levels.add('owner')
    if (t.includes('ceo') || t.includes('chief') || t.includes('president')) levels.add('c-suite')
    if (t.includes('founder')) levels.add('founder')
    if (t.includes('director')) levels.add('director')
    if (t.includes('vp') || t.includes('vice president')) levels.add('vice president')
    if (t.includes('manager')) levels.add('manager')
    if (t.includes('partner')) levels.add('partner')
  }
  // Default: owner + c-suite cover most SMB ICP targets
  if (levels.size === 0) {
    levels.add('owner')
    levels.add('c-suite')
    levels.add('founder')
  }
  return [...levels]
}

// Map location strings like "united states" → ISO alpha-2 codes
function mapLocations(locations: string[]): string[] {
  const codes: string[] = []
  for (const loc of locations) {
    const l = loc.toLowerCase().trim()
    if (l === 'united states' || l === 'us' || l === 'usa') codes.push('US')
    else if (l === 'canada' || l === 'ca') codes.push('CA')
    else if (l === 'united kingdom' || l === 'uk' || l === 'gb') codes.push('GB')
    else if (l === 'australia' || l === 'au') codes.push('AU')
    else if (l.length === 2) codes.push(l.toUpperCase())
  }
  return codes.length > 0 ? codes : ['US']
}

export type ExploriumSearchOptions = {
  limit?: number
  hasEmail?: boolean
  hasPhone?: boolean
}

/** Build the Explorium fetch-prospects request body from our filter + ICP types. */
export function buildExploriumFilters(
  filters: ProspectSearchFilters,
  icpConfig: ICPConfig,
  options: ExploriumSearchOptions = {},
) {
  const jobLevels = titlesToJobLevels(filters.jobTitles)
  const sizeRanges = mapSizeRanges(filters.companySizeRanges)
  const countryCodes = mapLocations(filters.locations)
  const keywords = [
    ...(filters.industries ?? []),
    ...(filters.keywords ?? []),
    ...(filters.q ? [filters.q] : []),
  ].filter(Boolean)

  const requestFilters: Record<string, unknown> = {
    job_level: { values: jobLevels },
    company_size: sizeRanges.length > 0 ? { values: sizeRanges } : undefined,
    company_country_code: { values: countryCodes },
  }

  if (keywords.length > 0) {
    requestFilters.website_keywords = { values: keywords }
  }

  // Contact availability — guided by ICP config and caller options
  const needEmail = options.hasEmail ?? icpConfig.mustHaveEmail
  const needPhone = options.hasPhone ?? icpConfig.mustHavePhone
  if (needEmail) requestFilters.has_email = true
  if (needPhone) requestFilters.has_phone_number = true

  // Remove undefined values
  for (const key of Object.keys(requestFilters)) {
    if (requestFilters[key] === undefined) delete requestFilters[key]
  }

  return requestFilters
}

// ---------------------------------------------------------------------------
// Response mapping: Explorium prospect row → ProspectLead
// ---------------------------------------------------------------------------

function parseEmployeeCount(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    // "11-50" → midpoint
    const parts = raw.split('-').map(Number)
    if (parts.length === 2 && !isNaN(parts[0]!) && !isNaN(parts[1]!)) {
      return Math.round((parts[0]! + parts[1]!) / 2)
    }
    const n = parseInt(raw, 10)
    return isNaN(n) ? null : n
  }
  return null
}

function normalizeLinkedIn(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  if (raw.startsWith('http')) return raw
  return `https://${raw}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapExploriumProspect(row: any, enriched?: any): ProspectLead {
  const id = String(row.prospect_id ?? row.id ?? Math.random().toString(36).slice(2))

  // Actual Explorium discover response uses prospect_* prefixed fields
  const fullName: string = row.prospect_full_name ?? row.full_name ?? ''
  const fullParts = fullName.trim().split(' ')
  const firstName: string = row.prospect_first_name ?? row.first_name ?? fullParts[0] ?? ''
  const lastName: string =
    row.prospect_last_name ?? row.last_name ?? (fullParts.length > 1 ? fullParts.slice(1).join(' ') : '')

  return {
    id,
    firstName,
    lastName,
    title: row.prospect_job_title ?? row.job_title ?? row.title ?? '',
    email: enriched?.email ?? row.email ?? null,
    phone: enriched?.phone ?? row.phone_number ?? row.phone ?? null,
    linkedinUrl: normalizeLinkedIn(row.prospect_linkedin ?? row.linkedin_url ?? row.linkedin),
    organizationName: row.prospect_company_name ?? row.company_name ?? row.organization_name ?? '',
    organizationId: row.business_id ?? row.company_id ?? null,
    websiteUrl: row.prospect_company_website ?? row.website ?? row.company_website ?? null,
    city: row.prospect_city ?? row.city ?? null,
    state: row.prospect_region_name ?? row.state ?? null,
    employeeCount: parseEmployeeCount(row.company_size ?? row.employee_count),
    revenue: null,
    industry: row.industry ?? row.company_industry ?? null,
    technologies: Array.isArray(row.technologies) ? row.technologies : [],
    photoUrl: row.photo_url ?? row.profile_picture ?? null,
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export type ExploriumSearchMeta = {
  source: 'explorium'
  providerConfigured: boolean
  providerError?: string
  totalFound?: number
}

export type ExploriumSearchResult = {
  people: ProspectLead[]
  meta: ExploriumSearchMeta
}

/** Primary: fetch prospects from Explorium, then enrich with email/phone. */
export async function searchExplorium(
  filters: ProspectSearchFilters,
  icpConfig: ICPConfig,
  options: ExploriumSearchOptions = {},
): Promise<ExploriumSearchResult> {
  const limit = options.limit ?? 50
  const base = apiBase()

  // --- Step 1: discover prospects ---
  const discoverBody = {
    filters: buildExploriumFilters(filters, icpConfig, options),
    limit,
  }

  const discoverRes = await fetch(`${base}/prospects/discover`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(discoverBody),
    signal: AbortSignal.timeout(30_000),
  })

  if (!discoverRes.ok) {
    const text = await discoverRes.text().catch(() => '')
    throw new Error(`Explorium /prospects/discover ${discoverRes.status}: ${text.slice(0, 200)}`)
  }

  const discoverData = await discoverRes.json() as {
    prospects?: unknown[]
    results?: unknown[]
    data?: unknown[]
    total?: number
    count?: number
  }

  const rawProspects: unknown[] =
    discoverData.prospects ?? discoverData.results ?? discoverData.data ?? []

  if (rawProspects.length === 0) {
    return { people: [], meta: { source: 'explorium', providerConfigured: true, totalFound: 0 } }
  }

  // --- Step 2: enrich with contact info (email / phone) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prospectRows = rawProspects as any[]
  const prospectIds = prospectRows
    .map((r) => r.prospect_id ?? r.id)
    .filter(Boolean) as string[]

  let enrichedMap: Record<string, { email?: string | null; phone?: string | null }> = {}

  if (prospectIds.length > 0) {
    try {
      const enrichRes = await fetch(`${base}/prospects/enrich`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          prospect_ids: prospectIds,
          enrichments: ['contacts'],
          contact_types: ['email', 'phone'],
        }),
        signal: AbortSignal.timeout(30_000),
      })

      if (enrichRes.ok) {
        const enrichData = await enrichRes.json() as {
          prospects?: unknown[]
          results?: unknown[]
          data?: unknown[]
        }
        const enrichRows: unknown[] =
          enrichData.prospects ?? enrichData.results ?? enrichData.data ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of enrichRows as any[]) {
          const pid = row.prospect_id ?? row.id
          if (pid) {
            enrichedMap[String(pid)] = { email: row.email ?? null, phone: row.phone_number ?? row.phone ?? null }
          }
        }
      }
    } catch (enrichErr) {
      // Enrichment failure is non-fatal — we still return the bare prospects
      console.warn('[searchExplorium] enrichment step failed', enrichErr)
    }
  }

  const people = prospectRows.map((row) => {
    const pid = String(row.prospect_id ?? row.id ?? '')
    return mapExploriumProspect(row, enrichedMap[pid])
  })

  return {
    people,
    meta: {
      source: 'explorium',
      providerConfigured: true,
      totalFound: discoverData.total ?? discoverData.count ?? people.length,
    },
  }
}
