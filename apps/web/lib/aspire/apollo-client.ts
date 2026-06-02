import { env } from '@/lib/env'
import type { ApolloPersonResult, ApolloSearchFilters } from '@/lib/aspire/types'

const APOLLO_API_SEARCH_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search'
const APOLLO_LEGACY_SEARCH_URL = 'https://api.apollo.io/v1/mixed_people/search'

function apolloPersonId(raw: Record<string, unknown>): string | null {
  const nested =
    raw.person && typeof raw.person === 'object'
      ? (raw.person as Record<string, unknown>)
      : null
  const rawId = raw.id ?? raw.person_id ?? nested?.id
  if (typeof rawId === 'string' && rawId.length > 0) return rawId
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return String(rawId)
  if (typeof raw.email === 'string' && raw.email.length > 0) return `email:${raw.email}`
  const linkedin = typeof raw.linkedin_url === 'string' ? raw.linkedin_url : null
  if (linkedin) return `linkedin:${linkedin}`
  const name = [raw.first_name, raw.last_name ?? raw.last_name_obfuscated]
    .filter((v) => typeof v === 'string' && v.length > 0)
    .join('-')
  if (name.length > 2) return `name:${name}`
  return null
}

export function mapApolloPerson(raw: Record<string, unknown>): ApolloPersonResult | null {
  const org = (raw.organization ?? {}) as Record<string, unknown>
  const id = apolloPersonId(raw)
  if (!id) return null

  const lastName =
    typeof raw.last_name === 'string'
      ? raw.last_name
      : typeof raw.last_name_obfuscated === 'string'
        ? raw.last_name_obfuscated
        : ''

  return {
    id,
    firstName: typeof raw.first_name === 'string' ? raw.first_name : '',
    lastName,
    title: typeof raw.title === 'string' ? raw.title : '',
    email: typeof raw.email === 'string' ? raw.email : null,
    phone: typeof raw.phone_numbers === 'object' && Array.isArray(raw.phone_numbers)
      ? String((raw.phone_numbers[0] as Record<string, unknown>)?.sanitized_number ?? '')
      : null,
    linkedinUrl: typeof raw.linkedin_url === 'string' ? raw.linkedin_url : null,
    organizationName:
      typeof org.name === 'string'
        ? org.name
        : typeof raw.organization_name === 'string'
          ? raw.organization_name
          : 'Unknown',
    organizationId:
      typeof org.id === 'string'
        ? org.id
        : typeof org.id === 'number'
          ? String(org.id)
          : null,
    websiteUrl: typeof org.website_url === 'string' ? org.website_url : null,
    city: typeof raw.city === 'string' ? raw.city : null,
    state: typeof raw.state === 'string' ? raw.state : null,
    employeeCount:
      typeof org.estimated_num_employees === 'number' ? org.estimated_num_employees : null,
    revenue: typeof org.annual_revenue === 'number' ? org.annual_revenue : null,
    industry: typeof org.industry === 'string' ? org.industry : null,
    technologies: Array.isArray(org.technologies)
      ? org.technologies.filter((t): t is string => typeof t === 'string')
      : [],
    photoUrl: typeof raw.photo_url === 'string' ? raw.photo_url : null,
  }
}

function appendArray(params: URLSearchParams, key: string, values: string[] | undefined) {
  if (!values?.length) return
  for (const value of values) {
    params.append(`${key}[]`, value)
  }
}

/** Apollo expects filters as query params on api_search, not a JSON body. */
export function buildApolloQueryParams(
  filters: ApolloSearchFilters,
  page: number,
  perPage: number,
  interactive: boolean,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('per_page', String(perPage))

  const keywords = [...(filters.keywords ?? [])]
  if (filters.q) keywords.push(filters.q)
  if (filters.company) keywords.push(filters.company)
  const qKeywords = keywords.length > 0 ? keywords.join(' ') : undefined

  if (interactive) {
    if (qKeywords) {
      params.set('q_keywords', qKeywords)
      if (filters.q?.trim()) {
        const term = filters.q.trim()
        appendArray(params, 'person_titles', [
          term,
          `${term} manager`,
          `${term} director`,
          `head of ${term}`,
        ])
        params.set('include_similar_titles', 'true')
      }
    }
    appendArray(params, 'person_locations', filters.locations)
    return params
  }

  appendArray(params, 'person_titles', filters.jobTitles)
  appendArray(params, 'q_organization_keyword_tags', filters.industries)
  appendArray(params, 'organization_num_employees_ranges', filters.companySizeRanges)
  appendArray(params, 'person_locations', filters.locations)
  if (qKeywords) params.set('q_keywords', qKeywords)
  appendArray(params, 'contact_email_status', filters.contactEmailStatus)
  return params
}

function buildLegacyApolloBody(
  filters: ApolloSearchFilters,
  page: number,
  perPage: number,
  interactive: boolean,
) {
  const keywords = [...(filters.keywords ?? [])]
  if (filters.q) keywords.push(filters.q)
  if (filters.company) keywords.push(filters.company)
  const qKeywords = keywords.length > 0 ? keywords.join(' ') : undefined

  if (interactive) {
    return {
      page,
      per_page: perPage,
      ...(qKeywords ? { q_keywords: qKeywords } : {}),
      ...(filters.company ? { q_organization_name: filters.company } : {}),
      ...(filters.locations?.length ? { person_locations: filters.locations } : {}),
    }
  }

  return {
    page,
    per_page: perPage,
    person_titles: filters.jobTitles?.length ? filters.jobTitles : undefined,
    q_organization_keyword_tags: filters.industries?.length ? filters.industries : undefined,
    organization_num_employees_ranges: filters.companySizeRanges?.length
      ? filters.companySizeRanges
      : undefined,
    person_locations: filters.locations?.length ? filters.locations : undefined,
    q_keywords: qKeywords,
    contact_email_status: filters.contactEmailStatus?.length
      ? filters.contactEmailStatus
      : undefined,
  }
}

function parseApolloPeople(body: Record<string, unknown>): ApolloPersonResult[] {
  const rawPeople =
    (Array.isArray(body.people) ? body.people : null) ??
    (Array.isArray(body.contacts) ? body.contacts : null) ??
    []

  return rawPeople
    .map((row) => mapApolloPerson(row as Record<string, unknown>))
    .filter((person): person is ApolloPersonResult => person !== null)
}

export function stubResults(filters: ApolloSearchFilters): ApolloPersonResult[] {
  const keyword = (filters.q ?? filters.keywords?.join(' ') ?? '').trim().toLowerCase()
  const company = filters.company?.trim() || 'Northstar SaaS'

  const pool: ApolloPersonResult[] = [
    {
      id: 'stub-alex-chen',
      firstName: 'Alex',
      lastName: 'Chen',
      title: 'Founder',
      email: 'alex@northstar.io',
      linkedinUrl: 'https://linkedin.com/in/example',
      industry: 'Software',
      organizationName: company,
      organizationId: null,
      websiteUrl: null,
      city: 'Phoenix',
      state: 'AZ',
      employeeCount: 25,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
    {
      id: 'stub-jordan-reeves',
      firstName: 'Jordan',
      lastName: 'Reeves',
      title: 'VP Marketing',
      email: 'jordan@atlas.co',
      linkedinUrl: null,
      industry: 'Marketing',
      organizationName: 'Atlas Agency',
      organizationId: null,
      websiteUrl: null,
      city: 'Dallas',
      state: 'TX',
      employeeCount: 40,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
    {
      id: 'stub-sam-ortiz',
      firstName: 'Sam',
      lastName: 'Ortiz',
      title: 'Marketing Director',
      email: 'sam@brightpath.co',
      linkedinUrl: null,
      industry: 'Marketing',
      organizationName: 'Brightpath Digital',
      organizationId: null,
      websiteUrl: null,
      city: 'Austin',
      state: 'TX',
      employeeCount: 55,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
  ]

  if (!keyword) return pool

  const matched = pool.filter(
    (p) =>
      p.title.toLowerCase().includes(keyword) ||
      (p.industry?.toLowerCase().includes(keyword) ?? false) ||
      p.organizationName.toLowerCase().includes(keyword),
  )

  if (matched.length > 0) return matched

  return [
    {
      id: `stub-${keyword.replace(/\s+/g, '-')}`,
      firstName: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      lastName: 'Prospect',
      title: `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Manager`,
      email: null,
      linkedinUrl: null,
      industry: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      organizationName: company,
      organizationId: null,
      websiteUrl: null,
      city: null,
      state: null,
      employeeCount: null,
      revenue: null,
      phone: null,
      technologies: [],
      photoUrl: null,
    },
  ]
}

async function requestApolloApiSearch(
  apiKey: string,
  params: URLSearchParams,
): Promise<ApolloPersonResult[]> {
  const url = `${APOLLO_API_SEARCH_URL}?${params.toString()}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
  })

  const body = (await response.json()) as Record<string, unknown>

  if (!response.ok) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : 'Apollo search failed',
    )
  }

  return parseApolloPeople(body)
}

async function requestApolloLegacySearch(
  apiKey: string,
  filters: ApolloSearchFilters,
  page: number,
  perPage: number,
  interactive: boolean,
): Promise<ApolloPersonResult[]> {
  const response = await fetch(APOLLO_LEGACY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(buildLegacyApolloBody(filters, page, perPage, interactive)),
  })

  const body = (await response.json()) as Record<string, unknown>

  if (!response.ok) {
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : 'Apollo search failed',
    )
  }

  return parseApolloPeople(body)
}

export async function searchApollo(
  filters: ApolloSearchFilters,
  page = 1,
  perPage = 25,
  interactive = false,
): Promise<{ people: ApolloPersonResult[]; total: number; hasMore: boolean }> {
  const apiKey =
    process.env.APOLLO_API_KEY?.trim() || env.APOLLO_API_KEY?.trim() || ''
  if (!apiKey) {
    const people = stubResults(filters)
    return { people, total: people.length, hasMore: false }
  }

  const params = buildApolloQueryParams(filters, page, perPage, interactive)

  let people: ApolloPersonResult[] = []
  try {
    people = await requestApolloApiSearch(apiKey, params)
  } catch (apiError) {
    console.warn('[searchApollo] api_search failed, trying legacy:', apiError)
  }

  if (people.length === 0) {
    try {
      people = await requestApolloLegacySearch(apiKey, filters, page, perPage, interactive)
    } catch (legacyError) {
      console.warn('[searchApollo] legacy search failed:', legacyError)
      if (interactive && (filters.q || filters.company)) {
        throw legacyError
      }
    }
  }

  const total = people.length
  const hasMore = page * perPage < total
  return { people, total, hasMore }
}
