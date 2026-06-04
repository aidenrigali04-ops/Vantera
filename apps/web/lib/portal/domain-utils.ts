import { PRODUCTION_APP_DOMAIN } from '@/config/public-env-defaults'

/** Hostname-only portal domain (no scheme, port, or path). */
export const PORTAL_DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i

export type PortalDomainDnsRecord = {
  type: 'CNAME' | 'TXT'
  host: string
  value: string
  purpose: string
  status?: string
}

export type PortalDomainDnsPayload = {
  cnameTarget: string
  records: PortalDomainDnsRecord[]
  vercelConfigured?: boolean
  lastCheckedAt?: string
}

export function normalizePortalDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
}

export function isValidPortalDomain(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false
  if (!PORTAL_DOMAIN_REGEX.test(hostname)) return false
  if (hostname.includes('..')) return false
  return true
}

export function portalCnameTarget(): string {
  const configured = process.env.PORTAL_CUSTOM_DOMAIN_CNAME?.trim()
  if (configured) {
    return configured.replace(/^https?:\/\//, '').replace(/\/$/, '')
  }
  return process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || PRODUCTION_APP_DOMAIN
}

export function isReservedPlatformHost(hostname: string): boolean {
  const host = normalizePortalDomain(hostname)
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || PRODUCTION_APP_DOMAIN
  if (host === appDomain || host === `www.${appDomain}`) return true
  if (host.endsWith('.vercel.app')) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.lvh.me')) {
    return true
  }
  return false
}

export function buildDefaultPortalDnsRecords(hostname: string): PortalDomainDnsPayload {
  const target = portalCnameTarget()
  return {
    cnameTarget: target,
    records: [
      {
        type: 'CNAME',
        host: hostname,
        value: target,
        purpose: 'Routes your branded portal to Vantera',
      },
    ],
  }
}

export function parsePortalDomainDns(raw: unknown): PortalDomainDnsPayload {
  if (!raw || typeof raw !== 'object') {
    return { cnameTarget: portalCnameTarget(), records: [] }
  }
  const payload = raw as PortalDomainDnsPayload
  return {
    cnameTarget: payload.cnameTarget || portalCnameTarget(),
    records: Array.isArray(payload.records) ? payload.records : [],
    vercelConfigured: payload.vercelConfigured,
    lastCheckedAt: payload.lastCheckedAt,
  }
}

/** Use custom hostname in client-facing links only when DNS is verified. */
export function effectivePortalDomainForLinks(
  portalDomain: string | null | undefined,
  status: string | null | undefined,
): string | null {
  const host = portalDomain?.trim()
  if (!host) return null
  if (status === 'verified') return host
  return null
}
