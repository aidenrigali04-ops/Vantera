import { env } from '@/lib/env'
import { normalizeDomain } from '@/lib/outreach/email-domain'

export type ResendDnsRecord = {
  record: string
  name: string
  type: string
  value: string
  status?: string
  priority?: number
  ttl?: string
}

export type ResendDomainCapabilities = {
  sending?: 'enabled' | 'disabled'
  receiving?: 'enabled' | 'disabled'
}

export type ResendDomainResponse = {
  id: string
  name: string
  status: string
  records?: ResendDnsRecord[]
  capabilities?: ResendDomainCapabilities
}

export type StoredOutreachDomainDns = {
  sendingRecords?: ResendDnsRecord[]
  inboundRecords?: ResendDnsRecord[]
  resendInboundDomainId?: string | null
  /** @deprecated use sendingRecords */
  records?: ResendDnsRecord[]
}

function extractResendError(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const obj = body as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message.trim()) return obj.message
  if (obj.error && typeof obj.error === 'object') {
    const nested = obj.error as Record<string, unknown>
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message
  }
  return fallback
}

function unwrapResendEntity<T extends Record<string, unknown>>(body: unknown): T {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid response from Resend')
  }

  const obj = body as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>
    if (typeof nested.id === 'string' || typeof nested.name === 'string') {
      return nested as T
    }
  }

  return obj as T
}

function unwrapResendList<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[]
  if (!body || typeof body !== 'object') return []
  const obj = body as Record<string, unknown>
  if (Array.isArray(obj.data)) return obj.data as T[]
  return []
}

async function resendFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'Email provider is not configured on this workspace. Contact support to enable outreach domains.',
    )
  }

  return fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function normalizeDomainResponse(raw: Record<string, unknown>): ResendDomainResponse {
  const id = typeof raw.id === 'string' ? raw.id : ''
  const name = typeof raw.name === 'string' ? raw.name : ''
  const status = typeof raw.status === 'string' ? raw.status : 'pending'
  const records = Array.isArray(raw.records) ? (raw.records as ResendDnsRecord[]) : []

  if (!id || !name) {
    throw new Error('Resend returned an incomplete domain response')
  }

  return {
    id,
    name,
    status,
    records,
    capabilities: raw.capabilities as ResendDomainCapabilities | undefined,
  }
}

export async function listResendDomains(): Promise<ResendDomainResponse[]> {
  const response = await resendFetch('/domains')
  const body = await response.json()
  if (!response.ok) {
    throw new Error(extractResendError(body, 'Could not list domains from Resend'))
  }

  return unwrapResendList<Record<string, unknown>>(body).map(normalizeDomainResponse)
}

export async function findResendDomainByName(domain: string): Promise<ResendDomainResponse | null> {
  const normalized = normalizeDomain(domain)
  const domains = await listResendDomains()
  const match = domains.find((row) => normalizeDomain(row.name) === normalized)
  if (!match) return null
  return loadResendDomainWithRecords(match.id)
}

export async function createResendDomain(
  domain: string,
  capabilities: ResendDomainCapabilities = { sending: 'enabled', receiving: 'disabled' },
): Promise<ResendDomainResponse> {
  const response = await resendFetch('/domains', {
    method: 'POST',
    body: JSON.stringify({
      name: normalizeDomain(domain),
      capabilities: {
        sending: capabilities.sending ?? 'enabled',
        receiving: capabilities.receiving ?? 'disabled',
      },
    }),
  })

  const body = await response.json()
  if (!response.ok) {
    throw new Error(extractResendError(body, 'Could not register domain with Resend'))
  }

  const created = normalizeDomainResponse(unwrapResendEntity<Record<string, unknown>>(body))
  return loadResendDomainWithRecords(created.id)
}

export async function getResendDomain(domainId: string): Promise<ResendDomainResponse> {
  const response = await resendFetch(`/domains/${domainId}`)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(extractResendError(body, 'Could not load domain from Resend'))
  }

  return normalizeDomainResponse(unwrapResendEntity<Record<string, unknown>>(body))
}

const RECORD_FETCH_DELAYS_MS = [0, 400, 900, 1600]

/** Resend may return an empty records array immediately after create — retry before giving up. */
export async function loadResendDomainWithRecords(domainId: string): Promise<ResendDomainResponse> {
  let last: ResendDomainResponse | null = null

  for (const delayMs of RECORD_FETCH_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    const domain = await getResendDomain(domainId)
    last = domain
    if ((domain.records?.length ?? 0) > 0) {
      return domain
    }
  }

  return last ?? getResendDomain(domainId)
}

export async function verifyResendDomain(domainId: string): Promise<ResendDomainResponse> {
  const response = await resendFetch(`/domains/${domainId}/verify`, { method: 'POST' })
  const body = await response.json()
  if (!response.ok) {
    throw new Error(extractResendError(body, 'Domain verification failed'))
  }

  // Verify endpoint returns a minimal payload — reload full domain (with records).
  return loadResendDomainWithRecords(domainId)
}

export async function ensureResendDomain(
  domain: string,
  capabilities: ResendDomainCapabilities,
  existingId?: string | null,
): Promise<ResendDomainResponse> {
  const normalized = normalizeDomain(domain)

  if (existingId) {
    try {
      const existing = await loadResendDomainWithRecords(existingId)
      if (normalizeDomain(existing.name) === normalized) {
        return existing
      }
    } catch {
      // Stale id — fall through to create/find.
    }
  }

  try {
    return await createResendDomain(normalized, capabilities)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/already exists|already registered|duplicate|has been registered/i.test(message)) {
      const existing = await findResendDomainByName(normalized)
      if (existing) return loadResendDomainWithRecords(existing.id)
    }
    throw error
  }
}

export function mapResendStatus(status: string): 'pending' | 'verified' | 'failed' {
  if (status === 'verified') return 'verified'
  if (status === 'failed' || status === 'temporary_failure' || status === 'partially_failed') {
    return 'failed'
  }
  return 'pending'
}

export function partitionDnsRecords(records: ResendDnsRecord[]): {
  sendingRecords: ResendDnsRecord[]
  inboundRecords: ResendDnsRecord[]
} {
  const inboundRecords = records.filter(
    (record) => record.record?.toLowerCase() === 'receiving',
  )
  const sendingRecords = records.filter((record) => !inboundRecords.includes(record))
  return { sendingRecords, inboundRecords }
}

export function parseStoredDomainDns(raw: unknown): {
  sendingRecords: ResendDnsRecord[]
  inboundRecords: ResendDnsRecord[]
  resendInboundDomainId: string | null
} {
  if (!raw || typeof raw !== 'object') {
    return { sendingRecords: [], inboundRecords: [], resendInboundDomainId: null }
  }

  const stored = raw as StoredOutreachDomainDns
  if (stored.sendingRecords || stored.inboundRecords) {
    return {
      sendingRecords: stored.sendingRecords ?? [],
      inboundRecords: stored.inboundRecords ?? [],
      resendInboundDomainId: stored.resendInboundDomainId ?? null,
    }
  }

  const legacy = stored.records ?? []
  const { sendingRecords, inboundRecords } = partitionDnsRecords(legacy)
  return {
    sendingRecords,
    inboundRecords,
    resendInboundDomainId: stored.resendInboundDomainId ?? null,
  }
}
