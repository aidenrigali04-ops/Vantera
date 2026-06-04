import type { PortalDomainDnsRecord } from '@/lib/portal/domain-utils'

type VercelDomainResponse = {
  name?: string
  verified?: boolean
  verification?: Array<{
    type: string
    domain: string
    value: string
    reason?: string
  }>
  error?: { code?: string; message?: string }
}

function vercelHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export function isVercelDomainProvisioningEnabled(): boolean {
  return Boolean(
    process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim(),
  ) && Boolean(process.env.VERCEL_PROJECT_ID?.trim())
}

export async function registerPortalDomainOnVercel(
  hostname: string,
): Promise<{ ok: true; records: PortalDomainDnsRecord[] } | { ok: false; reason: string }> {
  const token = process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim()
  const projectId = process.env.VERCEL_PROJECT_ID?.trim()

  if (!token || !projectId) {
    return { ok: false, reason: 'Vercel API not configured' }
  }

  const response = await fetch(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains`,
    {
      method: 'POST',
      headers: vercelHeaders(token),
      body: JSON.stringify({ name: hostname }),
    },
  )

  const json = (await response.json().catch(() => ({}))) as VercelDomainResponse

  if (!response.ok) {
    const message = json.error?.message ?? `Vercel API HTTP ${response.status}`
    return { ok: false, reason: message }
  }

  const records: PortalDomainDnsRecord[] = (json.verification ?? []).map((row) => ({
    type: row.type === 'TXT' ? 'TXT' : 'CNAME',
    host: row.domain,
    value: row.value,
    purpose: 'Required to attach this hostname to your Vantera deployment',
    status: json.verified ? 'verified' : 'pending',
  }))

  return { ok: true, records }
}
