import { toEnrichedAspireSearchResult } from '@/lib/aspire/enrich-prospect'
import {
  mapLeadProfileRow,
  mergeProspectLeadFields,
  profileFromEnrichmentBlob,
  storedEnrichmentMetrics,
} from '@/lib/aspire/lead-display'
import type { AspireResultWithContext } from '@/lib/aspire/queries'
import type { AspireSearchResult } from '@/lib/aspire/types'
import { readProspectContact } from '@/lib/aspire/contact-fields'

type RawAspireRow = Record<string, unknown>

export function hydrateAspireSearchResult(
  row: AspireResultWithContext | {
    id: string
    apifyId: string | null
    icpScore: number
    icpSignals: unknown
    status: string
    enrolledAt?: Date | string | null
    leadId?: string | null
    rawData: unknown
    lead?: AspireResultWithContext['lead']
    profile?: AspireResultWithContext['profile']
  },
  extra?: Record<string, unknown>,
): AspireSearchResult & { status: string; resultId: string } {
  const aspireRow =
    'result' in row
      ? row.result
      : {
          id: row.id,
          apifyId: row.apifyId,
          icpScore: row.icpScore,
          icpSignals: row.icpSignals,
          status: row.status,
          enrolledAt: row.enrolledAt ?? null,
          leadId: row.leadId ?? null,
          rawData: row.rawData,
        }

  const lead = 'result' in row ? row.lead : (row.lead ?? null)
  const profileRow = 'result' in row ? row.profile : (row.profile ?? null)

  const raw = (aspireRow.rawData ?? {}) as RawAspireRow
  const contact = readProspectContact(raw)
  const icpSignals = Array.isArray(aspireRow.icpSignals)
    ? aspireRow.icpSignals.filter((signal): signal is string => typeof signal === 'string')
    : []

  const person = mergeProspectLeadFields({
    raw: {
      ...raw,
      email: raw.email ?? contact.email,
      phone: raw.phone ?? contact.phone,
      linkedinUrl: raw.linkedinUrl ?? contact.linkedinUrl,
    },
    lead: lead
      ? {
          firstName: lead.firstName,
          lastName: lead.lastName,
          title: lead.title,
          company: lead.company,
          email: lead.email ?? contact.email,
          phone: lead.phone ?? contact.phone,
          linkedinUrl: lead.linkedinUrl ?? contact.linkedinUrl,
          avatarUrl: lead.avatarUrl,
          enrichment: lead.enrichment,
        }
      : null,
    apifyId: aspireRow.apifyId,
    resultId: aspireRow.id,
  })

  if (!person.email && contact.email) person.email = contact.email
  if (!person.phone && contact.phone) person.phone = contact.phone
  if (!person.linkedinUrl && contact.linkedinUrl) person.linkedinUrl = contact.linkedinUrl

  const enrichedBlobSignals = lead?.enrichment
    ? (() => {
        const blob = lead.enrichment as Record<string, unknown>
        return Array.isArray(blob.icpSignals)
          ? blob.icpSignals.filter((s): s is string => typeof s === 'string')
          : []
      })()
    : []

  const mergedSignals = [...new Set([...icpSignals, ...enrichedBlobSignals])].slice(0, 16)

  const hydrated = toEnrichedAspireSearchResult(person, aspireRow.icpScore, mergedSignals)

  const storedMetrics = lead?.enrichment ? storedEnrichmentMetrics(lead.enrichment) : null
  const leadProfile =
    mapLeadProfileRow(profileRow) ?? profileFromEnrichmentBlob(lead?.enrichment)

  const enrolledAt =
    aspireRow.enrolledAt instanceof Date
      ? aspireRow.enrolledAt.toISOString()
      : aspireRow.enrolledAt
        ? String(aspireRow.enrolledAt)
        : null

  const leadEnrichment =
    lead?.enrichment && typeof lead.enrichment === 'object'
      ? (lead.enrichment as Record<string, unknown>)
      : null

  return {
    ...hydrated,
    ...(storedMetrics?.enrichmentScore != null
      ? {
          enrichmentScore: storedMetrics.enrichmentScore,
          enrichmentCompleteness: storedMetrics.enrichmentCompleteness ?? hydrated.enrichmentCompleteness,
          enrichmentTier: storedMetrics.enrichmentTier ?? hydrated.enrichmentTier,
        }
      : {}),
    status: aspireRow.status,
    resultId: aspireRow.id,
    enrolledAt,
    leadId: aspireRow.leadId ?? lead?.id ?? null,
    leadEnrichment,
    leadProfile,
    ...extra,
  }
}
