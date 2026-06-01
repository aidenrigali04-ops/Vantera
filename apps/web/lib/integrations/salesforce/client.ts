import type { CrmLeadRecord } from '@/lib/integrations/types'

function normalizeInstanceUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('http')) return trimmed
  return `https://${trimmed}`
}

export async function validateSalesforceCredentials(
  accessToken: string,
  instanceUrl: string,
): Promise<boolean> {
  try {
    const base = normalizeInstanceUrl(instanceUrl)
    const response = await fetch(`${base}/services/data/v58.0/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return response.ok
  } catch {
    return false
  }
}

type SalesforceLeadRow = {
  Id: string
  FirstName?: string | null
  LastName?: string | null
  Email?: string | null
  Phone?: string | null
  Title?: string | null
  Company?: string | null
}

export async function fetchSalesforceLeads(
  accessToken: string,
  instanceUrl: string,
  limit = 100,
): Promise<CrmLeadRecord[]> {
  const base = normalizeInstanceUrl(instanceUrl)
  const query = encodeURIComponent(
    `SELECT Id, FirstName, LastName, Email, Phone, Title, Company FROM Lead LIMIT ${Math.min(limit, 200)}`,
  )

  const response = await fetch(`${base}/services/data/v58.0/query?q=${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Salesforce query failed: ${response.status}`)
  }

  const payload = (await response.json()) as { records?: SalesforceLeadRow[] }
  return (payload.records ?? []).map((row) => ({
    externalId: row.Id,
    firstName: row.FirstName ?? null,
    lastName: row.LastName ?? null,
    email: row.Email ?? null,
    phone: row.Phone ?? null,
    title: row.Title ?? null,
    company: row.Company ?? 'Unknown company',
  }))
}

export async function createSalesforceLead(
  accessToken: string,
  instanceUrl: string,
  lead: Omit<CrmLeadRecord, 'externalId'>,
): Promise<string> {
  const base = normalizeInstanceUrl(instanceUrl)
  const response = await fetch(`${base}/services/data/v58.0/sobjects/Lead`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      FirstName: lead.firstName ?? undefined,
      LastName: lead.lastName ?? 'Contact',
      Email: lead.email ?? undefined,
      Phone: lead.phone ?? undefined,
      Title: lead.title ?? undefined,
      Company: lead.company,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Salesforce create failed: ${response.status}`)
  }

  const payload = (await response.json()) as { id?: string }
  if (!payload.id) throw new Error('Salesforce did not return a lead id')
  return payload.id
}
