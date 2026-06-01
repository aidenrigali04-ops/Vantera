import { env } from '@/lib/env'

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

type ResendDomainResponse = {
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

async function resendFetch(path: string, init?: RequestInit): Promise<Response> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
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

export async function createResendDomain(
  domain: string,
  capabilities: ResendDomainCapabilities = { sending: 'enabled', receiving: 'disabled' },
): Promise<ResendDomainResponse> {
  const response = await resendFetch('/domains', {
    method: 'POST',
    body: JSON.stringify({
      name: domain,
      capabilities: {
        sending: capabilities.sending ?? 'enabled',
        receiving: capabilities.receiving ?? 'disabled',
      },
    }),
  })

  const body = (await response.json()) as ResendDomainResponse & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Could not register domain with Resend')
  }

  return body
}

export async function getResendDomain(domainId: string): Promise<ResendDomainResponse> {
  const response = await resendFetch(`/domains/${domainId}`)
  const body = (await response.json()) as ResendDomainResponse & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Could not load domain from Resend')
  }

  return body
}

export async function verifyResendDomain(domainId: string): Promise<ResendDomainResponse> {
  const response = await resendFetch(`/domains/${domainId}/verify`, { method: 'POST' })
  const body = (await response.json()) as ResendDomainResponse & { message?: string }
  if (!response.ok) {
    throw new Error(body.message ?? 'Domain verification failed')
  }

  return body
}

export function mapResendStatus(status: string): 'pending' | 'verified' | 'failed' {
  if (status === 'verified') return 'verified'
  if (status === 'failed' || status === 'temporary_failure') return 'failed'
  return 'pending'
}

export function partitionDnsRecords(records: ResendDnsRecord[]): {
  sendingRecords: ResendDnsRecord[]
  inboundRecords: ResendDnsRecord[]
} {
  const inboundRecords = records.filter(
    (record) =>
      record.record?.toLowerCase() === 'receiving' ||
      (record.type === 'MX' && record.record?.toLowerCase() !== 'spf'),
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
