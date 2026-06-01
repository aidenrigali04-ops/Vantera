import type { CrmLeadRecord } from '@/lib/integrations/types'

const GHL_BASE = 'https://services.leadconnectorhq.com'

function ghlHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Version: '2021-07-28',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

export async function validateGoHighLevelCredentials(
  accessToken: string,
  locationId: string,
): Promise<boolean> {
  try {
    const url = new URL(`${GHL_BASE}/contacts/`)
    url.searchParams.set('locationId', locationId)
    url.searchParams.set('limit', '1')

    const response = await fetch(url, { headers: ghlHeaders(accessToken) })
    return response.ok
  } catch {
    return false
  }
}

type GhlContact = {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  companyName?: string
  website?: string
}

export async function fetchGoHighLevelContacts(
  accessToken: string,
  locationId: string,
  limit = 100,
): Promise<CrmLeadRecord[]> {
  const url = new URL(`${GHL_BASE}/contacts/`)
  url.searchParams.set('locationId', locationId)
  url.searchParams.set('limit', String(Math.min(limit, 100)))

  const response = await fetch(url, { headers: ghlHeaders(accessToken) })
  if (!response.ok) {
    throw new Error(`GoHighLevel API error: ${response.status}`)
  }

  const payload = (await response.json()) as { contacts?: GhlContact[] }
  return (payload.contacts ?? []).map((contact) => ({
    externalId: contact.id,
    firstName: contact.firstName ?? null,
    lastName: contact.lastName ?? null,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    title: null,
    company: contact.companyName ?? contact.website ?? 'Unknown company',
  }))
}

export async function createGoHighLevelContact(
  accessToken: string,
  locationId: string,
  lead: Omit<CrmLeadRecord, 'externalId'>,
): Promise<string> {
  const response = await fetch(`${GHL_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(accessToken),
    body: JSON.stringify({
      locationId,
      firstName: lead.firstName ?? undefined,
      lastName: lead.lastName ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      companyName: lead.company,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `GoHighLevel create failed: ${response.status}`)
  }

  const payload = (await response.json()) as { contact?: { id?: string } }
  const id = payload.contact?.id
  if (!id) throw new Error('GoHighLevel did not return a contact id')
  return id
}
