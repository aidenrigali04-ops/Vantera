import type { AspireSearchResult } from '@/lib/aspire/types'
import { readProspectContact, splitFullName } from '@/lib/aspire/contact-fields'

type RawAspireRow = Record<string, unknown>

export function hydrateAspireSearchResult(
  row: {
    id: string
    apifyId: string | null
    icpScore: number
    icpSignals: unknown
    status: string
    rawData: unknown
  },
  extra?: Record<string, unknown>,
): AspireSearchResult & { status: string; resultId: string } {
  const raw = (row.rawData ?? {}) as RawAspireRow
  const contact = readProspectContact(raw)
  const icpSignals = Array.isArray(row.icpSignals)
    ? row.icpSignals.filter((signal): signal is string => typeof signal === 'string')
    : []

  const fullName = String(raw.full_name ?? raw.fullName ?? raw.contact_full_name ?? '')
  const split = fullName ? splitFullName(fullName) : { firstName: '', lastName: '' }

  return {
    id: row.apifyId ?? row.id,
    firstName: String(raw.firstName ?? raw.first_name ?? split.firstName),
    lastName: String(raw.lastName ?? raw.last_name ?? split.lastName),
    title: String(raw.title ?? raw.job_title ?? ''),
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedinUrl,
    organizationName: String(raw.organizationName ?? raw.company_name ?? raw.company ?? ''),
    organizationId: typeof raw.organizationId === 'string' ? raw.organizationId : null,
    websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : null,
    city: typeof raw.city === 'string' ? raw.city : null,
    state: typeof raw.state === 'string' ? raw.state : null,
    employeeCount: typeof raw.employeeCount === 'number' ? raw.employeeCount : null,
    revenue: typeof raw.revenue === 'number' ? raw.revenue : null,
    industry: typeof raw.industry === 'string' ? raw.industry : null,
    technologies: Array.isArray(raw.technologies)
      ? raw.technologies.filter((t): t is string => typeof t === 'string')
      : [],
    photoUrl: typeof raw.photoUrl === 'string' ? raw.photoUrl : null,
    icpScore: row.icpScore,
    icpSignals,
    intentScore: row.icpScore,
    company: String(raw.organizationName ?? raw.company_name ?? raw.company ?? ''),
    status: row.status,
    resultId: row.id,
    ...extra,
  }
}
