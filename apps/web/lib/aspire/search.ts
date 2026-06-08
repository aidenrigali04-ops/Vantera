import 'server-only'

import { isExploriumConfigured, searchExplorium } from '@/lib/aspire/explorium-client'
import { isInteractiveAspireSearch, normalizeProspectFilters } from '@/lib/aspire/filters'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import { toEnrichedAspireSearchResult } from '@/lib/aspire/enrich-prospect'
import type { ProspectSearchFilters, AspireSearchResult, ProspectSearchMeta } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { accounts, aspireResults } from '@vantera/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

export { normalizeProspectFilters } from '@/lib/aspire/filters'
/** @deprecated Use normalizeProspectFilters */
export { normalizeProspectFilters as normalizeApifyFilters } from '@/lib/aspire/filters'
export type { ProspectSearchMeta } from '@/lib/aspire/types'

export async function filterExistingLeads(
  accountId: string,
  apifyIds: string[],
): Promise<string[]> {
  if (apifyIds.length === 0) return []

  const rows = await db
    .select({ apifyId: aspireResults.apifyId })
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
        inArray(aspireResults.apifyId, apifyIds),
      ),
    )

  return rows.map((row) => row.apifyId!).filter(Boolean)
}


export type SearchProspectsResult = {
  results: AspireSearchResult[]
  meta: ProspectSearchMeta
}

async function persistAspireResults(
  accountId: string,
  scored: AspireSearchResult[],
  searchId: string | null,
): Promise<void> {
  if (scored.length === 0) return

  await Promise.all(
    scored.map(async (row) => {
      try {
        await db
          .insert(aspireResults)
          .values({
            accountId,
            searchId,
            apifyId: row.id,
            rawData: row,
            icpScore: row.icpScore,
            icpSignals: row.icpSignals,
            status: 'found',
          })
          .onConflictDoUpdate({
            target: [aspireResults.accountId, aspireResults.apifyId],
            set: {
              rawData: row,
              icpScore: row.icpScore,
              icpSignals: row.icpSignals,
              searchId: sql`coalesce(excluded.search_id, ${aspireResults.searchId})`,
            },
          })
      } catch (error) {
        console.error('[persistAspireResults] row failed:', row.id, error)
      }
    }),
  )
}

export async function searchProspects(
  accountId: string,
  filters: Partial<ProspectSearchFilters> = {},
  options?: { searchId?: string; persist?: boolean; limit?: number },
): Promise<SearchProspectsResult> {
  const [account] = await db
    .select({ vertical: accounts.vertical })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const vertical = account?.vertical ?? 'agency'
  const icpConfig = getIcpConfigForVertical(vertical)
  const interactive = isInteractiveAspireSearch(filters)
  const normalizedFilters = normalizeProspectFilters(vertical, filters, { interactive })

  let people: import('@/lib/aspire/types').ProspectLead[]
  let meta: ProspectSearchMeta

  // --- Primary: Explorium (Vibe Prospecting) ---
  if (isExploriumConfigured()) {
    try {
      const result = await searchExplorium(normalizedFilters, icpConfig, {
        limit: options?.limit,
        hasEmail: icpConfig.mustHaveEmail,
        hasPhone: icpConfig.mustHavePhone,
      })
      people = result.people
      meta = {
        source: 'explorium',
        providerConfigured: true,
        totalFound: result.meta.totalFound,
      }
    } catch (expErr) {
      const message = expErr instanceof Error ? expErr.message : 'Explorium search failed'
      console.error('[searchProspects] Explorium failed — falling back to stubs', message)
      people = []
      meta = { source: 'stub', providerConfigured: false, providerError: message }
    }

    if (people.length === 0) {
      // Explorium returned empty or failed — fall back to stubs
      const stubPeople = stubResults(normalizedFilters)
      people = stubPeople
      if (meta.source !== 'stub') {
        meta = {
          source: 'stub',
          providerConfigured: true,
          providerError: 'Explorium returned no results for this search.',
        }
      }
    }
  } else {
    // --- Explorium not configured: use stubs ---
    people = stubResults(normalizedFilters)
    meta = {
      source: 'stub',
      providerConfigured: false,
      providerError: 'EXPLORIUM_API_KEY is not set',
    }
  }

  const scored = people
    .map((person) => {
      const scoredResult = scoreICP(person, icpConfig)
      return toEnrichedAspireSearchResult(person, scoredResult.score, scoredResult.signals)
    })
    .sort((a, b) => b.icpScore - a.icpScore)

  if (options?.persist !== false && scored.length > 0) {
    await persistAspireResults(accountId, scored, options?.searchId ?? null)
  }

  return { results: scored, meta }
}

export type { AspireSearchResult } from '@/lib/aspire/types'
