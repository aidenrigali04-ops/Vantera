import 'server-only'

import { searchApify, type ProspectSearchMeta } from '@/lib/aspire/apify-client'
import { isInteractiveAspireSearch, normalizeApolloFilters } from '@/lib/aspire/filters'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
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
import { and, eq, inArray, isNull } from 'drizzle-orm'

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
  for (const row of scored) {
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
            searchId,
          },
        })
    } catch (error) {
      console.error('[persistAspireResults] row failed:', row.id, error)
    }
  }
}

export async function searchProspects(
  accountId: string,
  filters: Partial<ApolloSearchFilters> = {},
  options?: { searchId?: string; persist?: boolean },
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

  const { people, meta } = await searchApify(normalizedFilters, 1, 25, interactive)

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
