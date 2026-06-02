import { normalizeApolloFilters } from '@/lib/aspire/filters'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import type {
  ApolloPersonResult,
  ApolloSearchFilters,
  AspireSearchResult,
} from '@/lib/aspire/types'

export { normalizeApolloFilters } from '@/lib/aspire/filters'
import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { accounts, aspireResults } from '@vantera/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'

const APOLLO_SEARCH_URL = 'https://api.apollo.io/v1/mixed_people/search'
const PAGE_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function apolloPersonId(raw: Record<string, unknown>): string | null {
  const rawId = raw.id ?? raw.person_id
  if (typeof rawId === 'string' && rawId.length > 0) return rawId
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return String(rawId)
  return null
}

function mapApolloPerson(raw: Record<string, unknown>): ApolloPersonResult | null {
  const org = (raw.organization ?? {}) as Record<string, unknown>
  const id = apolloPersonId(raw)
  if (!id) return null

  return {
    id,
    firstName: typeof raw.first_name === 'string' ? raw.first_name : '',
    lastName: typeof raw.last_name === 'string' ? raw.last_name : '',
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
    organizationId: typeof org.id === 'string' ? org.id : null,
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

function buildApolloBody(filters: ApolloSearchFilters, page: number, perPage: number) {
  const keywords = [...(filters.keywords ?? [])]
  if (filters.q) keywords.push(filters.q)
  if (filters.company) keywords.push(filters.company)

  return {
    page,
    per_page: perPage,
    person_titles: filters.jobTitles?.length ? filters.jobTitles : undefined,
    q_organization_keyword_tags: filters.industries?.length ? filters.industries : undefined,
    organization_num_employees_ranges: filters.companySizeRanges?.length
      ? filters.companySizeRanges
      : undefined,
    person_locations: filters.locations?.length ? filters.locations : undefined,
    q_keywords: keywords.length > 0 ? keywords.join(' ') : undefined,
    contact_email_status: filters.contactEmailStatus?.length
      ? filters.contactEmailStatus
      : undefined,
  }
}

function stubResults(filters: ApolloSearchFilters): ApolloPersonResult[] {
  const company = filters.company ?? 'Northstar SaaS'
  return [
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
      title: 'VP Sales',
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
  ]
}

export async function searchApollo(
  filters: ApolloSearchFilters,
  page = 1,
  perPage = 25,
): Promise<{ people: ApolloPersonResult[]; total: number; hasMore: boolean }> {
  const apiKey = process.env.APOLLO_API_KEY ?? env.APOLLO_API_KEY
  if (!apiKey) {
    const people = stubResults(filters)
    return { people, total: people.length, hasMore: false }
  }

  if (page > 1) await sleep(PAGE_DELAY_MS)

  const response = await fetch(APOLLO_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(buildApolloBody(filters, page, perPage)),
  })

  const body = (await response.json()) as {
    people?: Record<string, unknown>[]
    contacts?: Record<string, unknown>[]
    pagination?: { total_entries?: number; page?: number; per_page?: number }
    error?: string
  }

  if (!response.ok) {
    throw new Error(body.error ?? 'Apollo search failed')
  }

  const rawPeople = body.people ?? body.contacts ?? []
  const people = rawPeople
    .map(mapApolloPerson)
    .filter((person): person is ApolloPersonResult => person !== null)

  const total = body.pagination?.total_entries ?? people.length
  const hasMore = page * perPage < total

  return { people, total, hasMore }
}

export async function filterExistingLeads(
  accountId: string,
  apolloIds: string[],
): Promise<string[]> {
  if (apolloIds.length === 0) return []

  const rows = await db
    .select({ apolloId: aspireResults.apolloId })
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
        inArray(aspireResults.apolloId, apolloIds),
      ),
    )

  return rows.map((row) => row.apolloId!).filter(Boolean)
}

function toAspireSearchResult(
  person: ApolloPersonResult,
  icpScore: number,
  icpSignals: string[],
): AspireSearchResult {
  return {
    ...person,
    icpScore,
    icpSignals,
    intentScore: icpScore,
    company: person.organizationName,
  }
}

export async function searchProspects(
  accountId: string,
  filters: Partial<ApolloSearchFilters> = {},
  options?: { searchId?: string; persist?: boolean },
): Promise<AspireSearchResult[]> {
  const [account] = await db
    .select({ vertical: accounts.vertical })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const vertical = account?.vertical ?? 'agency'
  const icpConfig = getIcpConfigForVertical(vertical)
  const normalizedFilters = normalizeApolloFilters(vertical, filters)

  const { people } = await searchApollo(normalizedFilters)

  const scored = people.map((person) => {
    const scoredResult = scoreICP(person, icpConfig)
    return toAspireSearchResult(person, scoredResult.score, scoredResult.signals)
  })

  if (options?.persist !== false && scored.length > 0) {
    const searchId = options?.searchId ?? null
    for (const row of scored) {
      await db
        .insert(aspireResults)
        .values({
          accountId,
          searchId,
          apolloId: row.id,
          rawData: row,
          icpScore: row.icpScore,
          icpSignals: row.icpSignals,
          status: 'found',
        })
        .onConflictDoUpdate({
          target: [aspireResults.accountId, aspireResults.apolloId],
          set: {
            rawData: row,
            icpScore: row.icpScore,
            icpSignals: row.icpSignals,
            ...(searchId != null ? { searchId } : {}),
          },
        })
    }
  }

  return scored.sort((a, b) => b.icpScore - a.icpScore)
}

export type { AspireSearchResult } from '@/lib/aspire/types'
