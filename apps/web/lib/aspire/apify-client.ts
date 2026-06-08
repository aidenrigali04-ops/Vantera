import 'server-only'

import {
  buildProspectId,
  extractEmail,
  extractLinkedIn,
  extractPhone,
  readString as readApifyString,
} from '@/lib/aspire/contact-fields'
import {
  isApifyConfigured,
  logApifyConfigDiagnostics,
  resolveApifyActorId,
  resolveApifyApiToken,
} from '@/lib/aspire/apify-config'
import {
  normalizeApifyLocations,
  resolveApifyKeywordTargeting,
} from '@/lib/aspire/apify-targeting'
import { splitFullName } from '@/lib/aspire/contact-fields'
import { isApifyAuthError, parseApifyErrorMessage } from '@/lib/aspire/apify-errors'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import type { ApifyLead, ApifySearchFilters } from '@/lib/aspire/types'
import { env } from '@/lib/env'

const APIFY_API_BASE = 'https://api.apify.com/v2'
/** Apify actor hard cap per run (code_crafter/leads-finder). */
const APIFY_MAX_FETCH = 100
const DEFAULT_ASPIRE_FETCH = 50
/** Vercel maxDuration is 300s — keep sync runs well under that (interactive = 2 runs max). */
const INTERACTIVE_SYNC_TIMEOUT_SEC = 90
const BATCH_SYNC_TIMEOUT_SEC = 120

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

export type ProspectSearchSource = 'apify' | 'stub' | 'demo' | 'explorium'

export type ProspectSearchMeta = {
  source: ProspectSearchSource
  providerConfigured: boolean
  providerError?: string
  /** Total matching records reported by the provider (may exceed returned rows). */
  totalFound?: number
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

function unwrapApifyRow(raw: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['person', 'lead', 'contact', 'data']) {
    const nested = raw[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return { ...(nested as Record<string, unknown>), ...raw }
    }
  }
  return raw
}

export function mapApifyLead(raw: Record<string, unknown>): ApifyLead | null {
  const row = unwrapApifyRow(raw)
  const id = buildProspectId(row)
  if (!id) return null

  let firstName = readString(row, ['first_name', 'firstName']) ?? ''
  let lastName = readString(row, ['last_name', 'lastName']) ?? ''
  if (!firstName && !lastName) {
    const full = readString(row, ['full_name', 'fullName', 'contact_full_name'])
    if (full) {
      const split = splitFullName(full)
      firstName = split.firstName
      lastName = split.lastName
    }
  }
  const contact = {
    email: extractEmail(row),
    phone: extractPhone(row),
    linkedinUrl: extractLinkedIn(row),
  }

  return {
    id,
    firstName,
    lastName,
    title: readString(row, ['job_title', 'title', 'headline']) ?? '',
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    organizationName:
      readString(row, ['company_name', 'organizationName', 'company']) ??
      readString(row, ['company_domain', 'companyDomain']) ??
      'Unknown',
    organizationId: null,
    websiteUrl: readString(row, ['company_website', 'websiteUrl', 'website']),
    city: readString(row, ['city', 'company_city']),
    state: readString(row, ['state', 'company_state']),
    employeeCount: parseEmployeeCount(row.company_size ?? row.employeeCount),
    revenue: null,
    industry: readString(row, ['industry', 'company_industry']),
    technologies: [],
    photoUrl: readString(row, ['photo_url', 'photoUrl']),
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
  filters: ApifySearchFilters,
  perPage: number,
  interactive: boolean,
): Record<string, unknown> {
  const keywords = [...(filters.keywords ?? [])]
  if (filters.q?.trim()) keywords.push(filters.q.trim())

  const fetchCount = getAspireApifyFetchCount(perPage)

  const input: Record<string, unknown> = {
    fetch_count: fetchCount,
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
    const targeting = resolveApifyKeywordTargeting(filters.q.trim())
    if (targeting.functional_level) {
      input.functional_level = targeting.functional_level
    }
    if (targeting.contact_job_title) {
      input.contact_job_title = targeting.contact_job_title
    }
  }

  input.contact_location = normalizeApifyLocations(
    filters.locations?.length ? filters.locations : ['united states'],
  )

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
  primary: ApifyLead[],
  extra: ApifyLead[],
  max: number,
): ApifyLead[] {
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
    email_status: ['validated', 'unknown', 'not_validated'],
    contact_location: base.contact_location ?? ['united states'],
  }
  if (Array.isArray(base.functional_level) && base.functional_level.length > 0) {
    retry.functional_level = base.functional_level
  } else if (Array.isArray(base.contact_job_title) && base.contact_job_title.length > 0) {
    retry.contact_job_title = base.contact_job_title
  }
  if (base.company_keywords) {
    retry.company_keywords = base.company_keywords
  }
  return retry
}

/** Widest search — location + volume only (actor rejects invalid filter combos). */
function buildMinimalRetryInput(pageSize: number): Record<string, unknown> {
  return {
    fetch_count: getAspireApifyFetchCount(pageSize),
    contact_location: ['united states'],
    email_status: ['validated', 'unknown', 'not_validated'],
  }
}

function actorIdForUrl(actorId: string): string {
  return actorId
    .split('~')
    .map((segment) => encodeURIComponent(segment))
    .join('~')
}

async function fetchApifyLeads(
  input: Record<string, unknown>,
  token: string,
  actorId: string,
  syncTimeoutSec: number,
): Promise<{ rows: Record<string, unknown>[]; people: ApifyLead[] }> {
  const url = `${APIFY_API_BASE}/acts/${actorIdForUrl(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${syncTimeoutSec}&format=json`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout((syncTimeoutSec + 25) * 1000),
  })

  if (!response.ok) {
    const errorText = parseApifyErrorMessage(await response.text(), 'Apify actor run failed')
    throw new Error(errorText)
  }

  const body = (await response.json()) as unknown
  const rows = parseApifyDatasetItems(body)
  const people = rows
    .map((row) => mapApifyLead(row))
    .filter((person): person is ApifyLead => person !== null)

  return { rows, people }
}

function apifyEmptyResultMessage(
  rows: Record<string, unknown>[],
  people: ApifyLead[],
  retriedBroad: boolean,
  retriedMinimal: boolean,
): string {
  const unmapped = Math.max(0, rows.length - people.length)
  if (rows.length > 0 && people.length === 0) {
    return `Apify returned ${rows.length} leads but none could be mapped (missing email/LinkedIn/name). Check APIFY_LEADS_ACTOR_ID.`
  }
  const retries = retriedMinimal ? ' (tried broad and minimal filters)' : retriedBroad ? ' (tried broad filters)' : ''
  return `Apify returned no leads for this search${retries}. Try a broader keyword, company name, or different filters.`
}

export async function searchApify(
  filters: ApifySearchFilters,
  page = 1,
  perPage?: number,
  interactive = false,
): Promise<{
  people: ApifyLead[]
  total: number
  hasMore: boolean
  meta: ProspectSearchMeta
}> {
  void page

  const token = resolveApifyApiToken()
  const actorId = resolveApifyActorId()
  const configured = isApifyConfigured()

  if (!configured) {
    logApifyConfigDiagnostics('searchApify')
    const people = stubResults(filters)
    return {
      people,
      total: people.length,
      hasMore: false,
      meta: {
        source: 'stub',
        providerConfigured: false,
        providerError: 'APIFY_API_TOKEN is not set',
      },
    }
  }

  const pageSize = interactive
    ? Math.min(getAspireApifyFetchCount(perPage), 25)
    : getAspireApifyFetchCount(perPage)
  const input = buildApifyActorInput(filters, pageSize, interactive)
  const syncTimeoutSec = interactive ? INTERACTIVE_SYNC_TIMEOUT_SEC : BATCH_SYNC_TIMEOUT_SEC
  const maxRuns = interactive ? 2 : 3

  let rows: Record<string, unknown>[] = []
  let people: ApifyLead[] = []
  let retriedBroad = false
  let retriedMinimal = false
  let runs = 0

  try {
    ;({ rows, people } = await fetchApifyLeads(input, token, actorId, syncTimeoutSec))
    runs += 1

    if (people.length === 0 && runs < maxRuns) {
      const retryInput = buildBroadRetryInput(input, pageSize)
      const retry = await fetchApifyLeads(retryInput, token, actorId, syncTimeoutSec)
      rows = rows.concat(retry.rows)
      people = mergePeople(people, retry.people, pageSize)
      retriedBroad = true
      runs += 1
    }

    if (people.length === 0 && runs < maxRuns && !interactive) {
      const minimal = await fetchApifyLeads(buildMinimalRetryInput(pageSize), token, actorId, syncTimeoutSec)
      rows = rows.concat(minimal.rows)
      people = mergePeople(people, minimal.people, pageSize)
      retriedMinimal = true
      runs += 1
    }

    if (people.length === 0) {
      const stubPeople = stubResults(filters)
      if (stubPeople.length > 0) {
        console.warn('[searchApify] no Apify matches — using stub leads', {
          actorId,
          retriedBroad,
          retriedMinimal,
        })
        return {
          people: stubPeople,
          total: stubPeople.length,
          hasMore: false,
          meta: {
            source: 'stub',
            providerConfigured: configured,
            providerError: apifyEmptyResultMessage(rows, people, retriedBroad, retriedMinimal),
          },
        }
      }
      throw new Error(
        apifyEmptyResultMessage(rows, people, retriedBroad, retriedMinimal),
      )
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
    const people = stubResults(filters)
    console.error('[searchApify] Apify unavailable — using stub leads', message, {
      actorId,
      input,
      apifyRowCount: rows.length,
      mapped: people.length,
      retriedBroad,
      retriedMinimal,
    })
    return {
      people,
      total: people.length,
      hasMore: false,
      meta: {
        source: 'stub',
        providerConfigured: configured && !isApifyAuthError(message),
        providerError: isApifyAuthError(message) ? 'Invalid Apify token' : message,
      },
    }
  }
}
