import 'server-only'

import {
  buildProspectId,
  extractEmail,
  extractLinkedIn,
  extractPhone,
  readString as readApifyString,
} from '@/lib/aspire/contact-fields'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import type { ApolloPersonResult, ApolloSearchFilters } from '@/lib/aspire/types'
import { env } from '@/lib/env'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const DEFAULT_LEADS_ACTOR_ID = 'code_crafter~leads-finder'

export type ProspectSearchSource = 'apify' | 'stub' | 'demo'

export type ProspectSearchMeta = {
  source: ProspectSearchSource
  providerConfigured: boolean
  providerError?: string
}

function readString(raw: Record<string, unknown>, keys: string[]): string | null {
  return readApifyString(raw, keys)
}

function parseEmployeeCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null
  const match = value.match(/(\d[\d,]*)/)
  if (!match) return null
  const parsed = Number.parseInt(match[1]!.replace(/,/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapApifyLead(raw: Record<string, unknown>): ApolloPersonResult | null {
  const id = buildProspectId(raw)
  if (!id) return null

  const firstName = readString(raw, ['first_name', 'firstName']) ?? ''
  const lastName = readString(raw, ['last_name', 'lastName']) ?? ''
  const contact = {
    email: extractEmail(raw),
    phone: extractPhone(raw),
    linkedinUrl: extractLinkedIn(raw),
  }

  return {
    id,
    firstName,
    lastName,
    title: readString(raw, ['job_title', 'title']) ?? '',
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    organizationName:
      readString(raw, ['company_name', 'organizationName', 'company']) ?? 'Unknown',
    organizationId: null,
    websiteUrl: readString(raw, ['company_website', 'websiteUrl', 'website']),
    city: readString(raw, ['city']),
    state: readString(raw, ['state']),
    employeeCount: parseEmployeeCount(raw.company_size ?? raw.employeeCount),
    revenue: null,
    industry: readString(raw, ['industry', 'company_industry']),
    technologies: [],
    photoUrl: readString(raw, ['photo_url', 'photoUrl']),
  }
}

function mapCompanySizeRanges(ranges: string[] | undefined): string[] | undefined {
  if (!ranges?.length) return undefined

  const apifySizes = new Set<string>()
  for (const range of ranges) {
    const parts = range.split(',').map((part) => Number.parseInt(part.trim(), 10))
    const minRaw = parts[0]
    const maxRaw = parts[1]
    if (minRaw === undefined || maxRaw === undefined) continue
    if (!Number.isFinite(minRaw) || !Number.isFinite(maxRaw)) continue
    if (maxRaw <= 10) apifySizes.add('2-10')
    if (minRaw <= 20 && maxRaw >= 11) apifySizes.add('11-20')
    if (minRaw <= 50 && maxRaw >= 21) apifySizes.add('21-50')
    if (minRaw <= 100 && maxRaw >= 51) apifySizes.add('51-100')
    if (minRaw <= 200 && maxRaw >= 101) apifySizes.add('101-200')
    if (maxRaw >= 201) apifySizes.add('201-500')
  }

  return apifySizes.size > 0 ? [...apifySizes] : undefined
}

export function buildApifyActorInput(
  filters: ApolloSearchFilters,
  perPage: number,
  interactive: boolean,
): Record<string, unknown> {
  const keywords = [...(filters.keywords ?? [])]
  if (filters.q?.trim()) keywords.push(filters.q.trim())

  const input: Record<string, unknown> = {
    fetch_count: Math.min(Math.max(perPage, 1), 100),
    email_status: ['validated', 'unknown'],
  }

  if (filters.company?.trim()) {
    input.company_keywords = [filters.company.trim()]
  } else if (!interactive && keywords.length > 0) {
    input.company_keywords = keywords
  }

  if (filters.jobTitles?.length) {
    input.contact_job_title = filters.jobTitles
  } else if (filters.q?.trim()) {
    const term = filters.q.trim()
    input.contact_job_title = [
      term,
      `${term} manager`,
      `${term} director`,
      `head of ${term}`,
      `director of ${term}`,
      `vp ${term}`,
    ]
  }

  if (filters.locations?.length) {
    input.contact_location = filters.locations
  }

  if (filters.industries?.length) {
    input.company_industry = filters.industries
  }

  const sizes = mapCompanySizeRanges(filters.companySizeRanges)
  if (sizes?.length) {
    input.size = sizes
  }

  return input
}

function apifyErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body.slice(0, 300)
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.error === 'string') return record.error
    if (typeof record.message === 'string') return record.message
  }
  return fallback
}

function demoFallback(
  filters: ApolloSearchFilters,
  configured: boolean,
  error?: string,
): {
  people: ApolloPersonResult[]
  total: number
  hasMore: boolean
  meta: ProspectSearchMeta
} {
  const people = stubResults(filters)
  return {
    people,
    total: people.length,
    hasMore: false,
    meta: {
      source: 'demo',
      providerConfigured: configured,
      providerError: error,
    },
  }
}

export async function searchApify(
  filters: ApolloSearchFilters,
  page = 1,
  perPage = 25,
  interactive = false,
): Promise<{
  people: ApolloPersonResult[]
  total: number
  hasMore: boolean
  meta: ProspectSearchMeta
}> {
  void page

  const token =
    process.env.APIFY_API_TOKEN?.trim() || env.APIFY_API_TOKEN?.trim() || ''
  const actorId =
    process.env.APIFY_LEADS_ACTOR_ID?.trim() ||
    env.APIFY_LEADS_ACTOR_ID?.trim() ||
    DEFAULT_LEADS_ACTOR_ID
  const configured = token.length > 0

  if (!configured) {
    const people = stubResults(filters)
    return {
      people,
      total: people.length,
      hasMore: false,
      meta: { source: 'stub', providerConfigured: false },
    }
  }

  const input = buildApifyActorInput(filters, perPage, interactive)
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=180&format=json`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const errorText = apifyErrorMessage(await response.text(), 'Apify actor run failed')
      if (interactive) return demoFallback(filters, true, errorText)
      return {
        people: [],
        total: 0,
        hasMore: false,
        meta: { source: 'apify', providerConfigured: true, providerError: errorText },
      }
    }

    const body = (await response.json()) as unknown
    const rows = Array.isArray(body) ? body : []
    const people = rows
      .map((row) => mapApifyLead(row as Record<string, unknown>))
      .filter((person): person is ApolloPersonResult => person !== null)

    if (people.length === 0 && interactive) {
      return demoFallback(filters, true, 'No leads matched your filters')
    }

    return {
      people,
      total: people.length,
      hasMore: people.length >= perPage,
      meta: { source: 'apify', providerConfigured: true },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apify search failed'
    if (interactive) return demoFallback(filters, true, message)
    throw error
  }
}
