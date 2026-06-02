import 'server-only'

import {
  buildProspectId,
  extractEmail,
  extractLinkedIn,
  extractPhone,
  readString as readApifyString,
} from '@/lib/aspire/contact-fields'
import { resolveApifyKeywordTargeting } from '@/lib/aspire/apify-targeting'
import { splitFullName } from '@/lib/aspire/contact-fields'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import type { ApolloPersonResult, ApolloSearchFilters } from '@/lib/aspire/types'
import { env } from '@/lib/env'

const APIFY_API_BASE = 'https://api.apify.com/v2'
const DEFAULT_LEADS_ACTOR_ID = 'code_crafter~leads-finder'
/** Apify actor hard cap per run (code_crafter/leads-finder). */
const APIFY_MAX_FETCH = 100
const DEFAULT_ASPIRE_FETCH = 50

/** Leads returned per Aspire / Apify search (override with ASPIRE_APIFY_FETCH_COUNT). */
export function getAspireApifyFetchCount(requested?: number): number {
  const fromEnv = Number.parseInt(
    process.env.ASPIRE_APIFY_FETCH_COUNT?.trim() ||
      env.ASPIRE_APIFY_FETCH_COUNT?.trim() ||
      '',
    10,
  )
  const envDefault =
    Number.isFinite(fromEnv) && fromEnv > 0
      ? Math.min(fromEnv, APIFY_MAX_FETCH)
      : DEFAULT_ASPIRE_FETCH
  const n = requested ?? envDefault
  return Math.min(Math.max(n, 1), APIFY_MAX_FETCH)
}

export type ProspectSearchSource = 'apify' | 'stub' | 'demo'

export type ProspectSearchMeta = {
  source: ProspectSearchSource
  providerConfigured: boolean
  providerError?: string
  /** Raw rows from Apify dataset before mapping. */
  apifyRowCount?: number
  /** Rows dropped because mapApifyLead returned null. */
  unmappedRowCount?: number
  /** True when a second broader Apify run was used to fill volume. */
  retriedBroad?: boolean
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

  let firstName = readString(raw, ['first_name', 'firstName']) ?? ''
  let lastName = readString(raw, ['last_name', 'lastName']) ?? ''
  if (!firstName && !lastName) {
    const full = readString(raw, ['full_name', 'fullName', 'contact_full_name'])
    if (full) {
      const split = splitFullName(full)
      firstName = split.firstName
      lastName = split.lastName
    }
  }
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
      readString(raw, ['company_name', 'organizationName', 'company']) ??
      readString(raw, ['company_domain', 'companyDomain']) ??
      'Unknown',
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

  const fetchCount = getAspireApifyFetchCount(perPage)

  const input: Record<string, unknown> = {
    fetch_count: fetchCount,
    // Broader than validated-only — Apify docs: add unknown/not_validated for higher volume
    email_status: ['validated', 'unknown', 'not_validated'],
  }

  if (filters.company?.trim()) {
    input.company_keywords = [filters.company.trim()]
  } else if (!interactive && keywords.length > 0) {
    input.company_keywords = keywords
  }

  if (filters.jobTitles?.length) {
    input.contact_job_title = filters.jobTitles
  } else if (filters.q?.trim()) {
    const targeting = resolveApifyKeywordTargeting(filters.q.trim())
    if (targeting.functional_level) {
      input.functional_level = targeting.functional_level
    }
    if (targeting.contact_job_title) {
      input.contact_job_title = targeting.contact_job_title
    }
  }

  if (filters.locations?.length) {
    input.contact_location = filters.locations
  } else if (interactive) {
    input.contact_location = ['united states']
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

function parseApifyDatasetItems(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) {
    return body.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object')
  }
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['items', 'data', 'results', 'datasetItems']) {
      const value = record[key]
      if (Array.isArray(value)) {
        return value.filter(
          (row): row is Record<string, unknown> => row !== null && typeof row === 'object',
        )
      }
    }
  }
  return []
}

function mergePeople(
  primary: ApolloPersonResult[],
  extra: ApolloPersonResult[],
  max: number,
): ApolloPersonResult[] {
  const seen = new Set(primary.map((p) => p.id))
  const merged = [...primary]
  for (const person of extra) {
    if (seen.has(person.id)) continue
    seen.add(person.id)
    merged.push(person)
    if (merged.length >= max) break
  }
  return merged
}

function buildBroadRetryInput(
  base: Record<string, unknown>,
  pageSize: number,
): Record<string, unknown> {
  const retry: Record<string, unknown> = {
    fetch_count: getAspireApifyFetchCount(pageSize),
    email_status: base.email_status,
    contact_location: base.contact_location ?? ['united states'],
  }
  if (Array.isArray(base.functional_level) && base.functional_level.length > 0) {
    retry.functional_level = base.functional_level
  }
  if (base.company_keywords) {
    retry.company_keywords = base.company_keywords
  }
  return retry
}

async function fetchApifyLeads(
  input: Record<string, unknown>,
  token: string,
  actorId: string,
): Promise<{ rows: Record<string, unknown>[]; people: ApolloPersonResult[] }> {
  const url = `${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=300&format=json`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const errorText = apifyErrorMessage(await response.text(), 'Apify actor run failed')
    throw new Error(errorText)
  }

  const body = (await response.json()) as unknown
  const rows = parseApifyDatasetItems(body)
  const people = rows
    .map((row) => mapApifyLead(row))
    .filter((person): person is ApolloPersonResult => person !== null)

  return { rows, people }
}

const MIN_INTERACTIVE_RESULTS = 10

function apifyErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body.slice(0, 300)
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    if (typeof record.error === 'string') return record.error
    if (typeof record.message === 'string') return record.message
  }
  return fallback
}

export async function searchApify(
  filters: ApolloSearchFilters,
  page = 1,
  perPage?: number,
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

  const pageSize = getAspireApifyFetchCount(perPage)
  const input = buildApifyActorInput(filters, pageSize, interactive)

  try {
    let { rows, people } = await fetchApifyLeads(input, token, actorId)
    let retriedBroad = false

    if (interactive && people.length < MIN_INTERACTIVE_RESULTS) {
      const retryInput = buildBroadRetryInput(input, pageSize)
      const retry = await fetchApifyLeads(retryInput, token, actorId)
      rows = rows.concat(retry.rows)
      people = mergePeople(people, retry.people, pageSize)
      retriedBroad = true
    }

    if (interactive && people.length === 0) {
      const demo = stubResults(filters)
      return {
        people: demo,
        total: demo.length,
        hasMore: false,
        meta: {
          source: 'demo',
          providerConfigured: true,
          apifyRowCount: rows.length,
          unmappedRowCount: Math.max(0, rows.length - people.length),
          retriedBroad,
        },
      }
    }

    return {
      people,
      total: people.length,
      hasMore: people.length >= pageSize,
      meta: {
        source: 'apify',
        providerConfigured: true,
        apifyRowCount: rows.length,
        unmappedRowCount: Math.max(0, rows.length - people.length),
        retriedBroad,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Apify search failed'
    if (interactive) {
      const demo = stubResults(filters)
      return {
        people: demo,
        total: demo.length,
        hasMore: false,
        meta: {
          source: 'demo',
          providerConfigured: true,
          providerError: message,
        },
      }
    }
    throw new Error(message)
  }
}
