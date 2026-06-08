import 'server-only'

import { isApifyConfigured } from '@/lib/aspire/apify-config'
import { searchApify, type ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { isExploriumConfigured, searchExplorium } from '@/lib/aspire/explorium-client'
import { isInteractiveAspireSearch, normalizeApifyFilters } from '@/lib/aspire/filters'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import { toEnrichedAspireSearchResult } from '@/lib/aspire/enrich-prospect'
import type { ApifySearchFilters, AspireSearchResult } from '@/lib/aspire/types'

export { normalizeApifyFilters } from '@/lib/aspire/filters'
export { searchApify } from '@/lib/aspire/apify-client'
export type { ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { db } from '@/lib/db/client'
import { accounts, aspireResults } from '@vantera/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

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
  filters: Partial<ApifySearchFilters> = {},
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
  const normalizedFilters = normalizeApifyFilters(vertical, filters, { interactive })

  let people: import('@/lib/aspire/types').ApifyLead[]
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
      console.error('[searchProspects] Explorium failed — falling back to Apify', message)
      // Fall through to Apify below
      people = []
      meta = { source: 'stub', providerConfigured: false, providerError: message }
    }

    if (people.length > 0) {
      // Explorium returned results — skip Apify
    } else {
      // Explorium returned empty or failed — try Apify
      try {
        ;({ people, meta } = await searchApify(normalizedFilters, 1, options?.limit, interactive))
      } catch (apifyErr) {
        const message = apifyErr instanceof Error ? apifyErr.message : 'Search failed'
        console.error('[searchProspects] Apify also failed — stub fallback', message)
        people = stubResults(normalizedFilters)
        meta = { source: 'stub', providerConfigured: isApifyConfigured(), providerError: message }
      }
    }
  } else {
    // --- Explorium not configured: use Apify ---
    try {
      ;({ people, meta } = await searchApify(normalizedFilters, 1, options?.limit, interactive))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed'
      console.error('[searchProspects] Apify failed — stub fallback', message)
      people = stubResults(normalizedFilters)
      meta = { source: 'stub', providerConfigured: isApifyConfigured(), providerError: message }
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
