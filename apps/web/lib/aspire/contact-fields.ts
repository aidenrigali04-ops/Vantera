/** Normalize contact fields from Apify actor rows or stored aspire rawData. */

export function readString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

export function extractEmail(raw: Record<string, unknown>): string | null {
  const business = readString(raw, ['email', 'work_email', 'business_email', 'contact_email'])
  const personal = readString(raw, ['personal_email'])
  const candidate = business ?? personal
  if (!candidate || !candidate.includes('@')) return null
  return candidate.toLowerCase()
}

export function extractPhone(raw: Record<string, unknown>): string | null {
  return readString(raw, [
    'mobile_number',
    'phone',
    'phone_number',
    'direct_phone',
    'mobile',
    'cell_phone',
    'sanitized_phone',
  ])
}

export function normalizeLinkedInUrl(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('linkedin.com') || trimmed.startsWith('www.linkedin.com')) {
    return `https://${trimmed.replace(/^\/\//, '')}`
  }
  if (trimmed.includes('linkedin.com/in/')) return `https://${trimmed.replace(/^\/\//, '')}`
  return trimmed
}

export function extractLinkedIn(raw: Record<string, unknown>): string | null {
  const url = readString(raw, [
    'linkedin',
    'linkedin_url',
    'linkedinUrl',
    'linked_in',
    'linkedin_profile',
    'person_linkedin',
  ])
  if (!url) return null
  if (url.includes('linkedin.com')) return normalizeLinkedInUrl(url)
  if (url.startsWith('in/') || url.startsWith('/in/')) {
    return normalizeLinkedInUrl(`https://www.linkedin.com/${url.replace(/^\//, '')}`)
  }
  return null
}

/** Read contact fields from mapped prospect rows or legacy Apify payloads. */
export function readProspectContact(raw: Record<string, unknown>): {
  email: string | null
  phone: string | null
  linkedinUrl: string | null
} {
  const mappedEmail = typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : null
  const mappedPhone = typeof raw.phone === 'string' && raw.phone.trim() ? raw.phone.trim() : null
  const mappedLinkedIn =
    typeof raw.linkedinUrl === 'string' && raw.linkedinUrl.trim() ? raw.linkedinUrl.trim() : null

  return {
    email: mappedEmail ?? extractEmail(raw),
    phone: mappedPhone ?? extractPhone(raw),
    linkedinUrl: mappedLinkedIn ?? extractLinkedIn(raw),
  }
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

export function buildProspectId(raw: Record<string, unknown>): string | null {
  const { email, linkedinUrl } = readProspectContact(raw)
  if (email) return `email:${email}`

  if (linkedinUrl) return `linkedin:${linkedinUrl}`

  const firstName = readString(raw, ['first_name', 'firstName']) ?? ''
  const lastName = readString(raw, ['last_name', 'lastName']) ?? ''
  const fullName = readString(raw, ['full_name', 'fullName', 'contact_full_name'])
  const company =
    readString(raw, ['company_name', 'organizationName', 'company']) ?? ''
  const domain = readString(raw, ['company_domain', 'companyDomain'])

  const displayName =
    [firstName, lastName].filter(Boolean).join(' ') || fullName || ''
  if (displayName && domain) {
    return `name:${displayName.toLowerCase()}@${domain.toLowerCase()}`
  }

  const nameKey = [firstName || fullName, lastName, company].filter(Boolean).join('-')
  if (nameKey.length > 2) return `name:${nameKey.toLowerCase()}`

  return null
}
