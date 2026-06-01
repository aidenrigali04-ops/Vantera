import type { CrmLeadRecord } from '@/lib/integrations/types'
import { Client } from '@hubspot/api-client'

export async function validateHubSpotToken(accessToken: string): Promise<boolean> {
  try {
    const client = new Client({ accessToken })
    await client.crm.contacts.basicApi.getPage(1)
    return true
  } catch {
    return false
  }
}

export async function fetchHubSpotContacts(
  accessToken: string,
  limit = 100,
): Promise<CrmLeadRecord[]> {
  const client = new Client({ accessToken })
  const response = await client.crm.contacts.basicApi.getPage(limit)

  return (response.results ?? []).map((contact) => {
    const props = contact.properties ?? {}
    return {
      externalId: contact.id,
      firstName: props.firstname ?? null,
      lastName: props.lastname ?? null,
      email: props.email ?? null,
      phone: props.phone ?? null,
      title: props.jobtitle ?? null,
      company: props.company ?? props.email?.split('@')[1] ?? 'Unknown company',
      linkedinUrl: props.hs_linkedin_url ?? null,
    }
  })
}

export async function createHubSpotContact(
  accessToken: string,
  lead: Omit<CrmLeadRecord, 'externalId'>,
): Promise<string> {
  const client = new Client({ accessToken })
  const properties: Record<string, string> = {}
  if (lead.firstName) properties.firstname = lead.firstName
  if (lead.lastName) properties.lastname = lead.lastName
  if (lead.email) properties.email = lead.email
  if (lead.phone) properties.phone = lead.phone
  if (lead.title) properties.jobtitle = lead.title
  if (lead.company) properties.company = lead.company

  const created = await client.crm.contacts.basicApi.create({ properties })

  return created.id
}
