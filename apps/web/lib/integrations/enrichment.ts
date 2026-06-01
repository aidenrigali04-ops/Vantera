import type { CrmProvider, LeadEnrichmentExternal } from '@/lib/integrations/types'

export function parseLeadEnrichment(raw: unknown): LeadEnrichmentExternal {
  if (!raw || typeof raw !== 'object') return {}
  return raw as LeadEnrichmentExternal
}

export function getExternalId(enrichment: unknown, provider: CrmProvider): string | null {
  const parsed = parseLeadEnrichment(enrichment)
  return parsed.externalIds?.[provider] ?? null
}

export function withExternalId(
  enrichment: unknown,
  provider: CrmProvider,
  externalId: string,
  direction: 'import' | 'export',
): LeadEnrichmentExternal {
  const parsed = parseLeadEnrichment(enrichment)
  const now = new Date().toISOString()

  return {
    ...parsed,
    externalIds: {
      ...parsed.externalIds,
      [provider]: externalId,
    },
    crmSync: {
      ...parsed.crmSync,
      [provider]: {
        ...parsed.crmSync?.[provider],
        ...(direction === 'import' ? { lastImportedAt: now } : { lastExportedAt: now }),
      },
    },
  }
}
