import 'server-only'

import { searchApify, type ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { isInteractiveAspireSearch, normalizeApolloFilters } from '@/lib/aspire/filters'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import type {
  ApolloPersonResult,
  ApolloSearchFilters,
  AspireSearchResult,
} from '@/lib/aspire/types'

export { normalizeApolloFilters } from '@/lib/aspire/filters'
export { searchApify } from '@/lib/aspire/apify-client'
export type { ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { db } from '@/lib/db/client'
import { accounts, aspireResults } from '@vantera/db'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

export async function filterExistingLeads(
  accountId: string,
  apolloIds: string[],
): Promise<string[]> {
  if (apolloIds.length === 0) return []

  const rows = await db
    .select({ apolloId: aspireResults.apolloId })
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
        inArray(aspireResults.apolloId, apolloIds),
      ),
    )

  return rows.map((row) => row.apolloId!).filter(Boolean)
}

function toAspireSearchResult(
  person: ApolloPersonResult,
  icpScore: number,
  icpSignals: string[],
): AspireSearchResult {
  return {
    ...person,
    icpScore,
    icpSignals,
    intentScore: icpScore,
    company: person.organizationName,
  }
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
            apolloId: row.id,
            rawData: row,
            icpScore: row.icpScore,
            icpSignals: row.icpSignals,
            status: 'found',
          })
          .onConflictDoUpdate({
            target: [aspireResults.accountId, aspireResults.apolloId],
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
  filters: Partial<ApolloSearchFilters> = {},
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
  const normalizedFilters = normalizeApolloFilters(vertical, filters, { interactive })

  let people: import('@/lib/aspire/types').ApolloPersonResult[]
  let meta: ProspectSearchMeta

  try {
    ;({ people, meta } = await searchApify(
      normalizedFilters,
      1,
      options?.limit,
      interactive,
    ))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed'
    console.error('[searchProspects] Apify failed — stub fallback', message)
    people = stubResults(normalizedFilters)
    meta = {
      source: 'stub',
      providerConfigured: false,
      providerError: message,
    }
  }

  const scored = people
    .map((person) => {
      const scoredResult = scoreICP(person, icpConfig)
      return toAspireSearchResult(person, scoredResult.score, scoredResult.signals)
    })
    .sort((a, b) => b.icpScore - a.icpScore)

  if (options?.persist !== false && scored.length > 0) {
    await persistAspireResults(accountId, scored, options?.searchId ?? null)
  }

  return { results: scored, meta }
}

export type { AspireSearchResult } from '@/lib/aspire/types'
