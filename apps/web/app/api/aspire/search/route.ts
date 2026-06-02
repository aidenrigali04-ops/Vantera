import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { isApifyConfigured } from '@/lib/aspire/apify-config'
import { searchProspects } from '@/lib/aspire/search'
import { stubResults } from '@/lib/aspire/prospect-stubs'
import { getIcpConfigForVertical, scoreICP } from '@/lib/aspire/icp-score'
import { normalizeApolloFilters, isInteractiveAspireSearch } from '@/lib/aspire/filters'
import type { ApolloSearchFilters, AspireSearchResult } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/** Apify sync runs can take several minutes. */
export const maxDuration = 300

function fallbackSearchResults(
  accountId: string,
  filters: Partial<ApolloSearchFilters>,
  vertical: string,
): { results: AspireSearchResult[]; meta: { source: 'stub'; providerConfigured: boolean; providerError: string } } {
  const interactive = isInteractiveAspireSearch(filters)
  const normalized = normalizeApolloFilters(vertical, filters, { interactive })
  const icpConfig = getIcpConfigForVertical(vertical)
  const people = stubResults(normalized)

  const results = people
    .map((person) => {
      const scored = scoreICP(person, icpConfig)
      return {
        ...person,
        icpScore: scored.score,
        icpSignals: scored.signals,
        intentScore: scored.score,
        company: person.organizationName,
      }
    })
    .sort((a, b) => b.icpScore - a.icpScore)

  void accountId
  return {
    results,
    meta: {
      source: 'stub',
      providerConfigured: isApifyConfigured(),
      providerError: 'Search fallback — live Apify run unavailable',
    },
  }
}

export async function GET(request: Request) {
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filters: ApolloSearchFilters = {
    jobTitles: [],
    industries: [],
    companySizeRanges: [],
    locations: [],
    q: searchParams.get('q') ?? undefined,
    company: searchParams.get('company') ?? undefined,
  }

  const { results, meta } = await searchProspects(session.accountId, filters, { persist: true }).catch(
    async (error) => {
      console.error('[aspire/search GET]', error)
      const [account] = await db
        .select({ vertical: accounts.vertical })
        .from(accounts)
        .where(eq(accounts.id, session.accountId))
        .limit(1)
      const fallback = fallbackSearchResults(session.accountId, filters, account?.vertical ?? 'agency')
      const message = error instanceof Error ? error.message : 'Search failed'
      fallback.meta.providerError = message
      fallback.meta.providerConfigured = isApifyConfigured()
      return fallback
    },
  )
  return NextResponse.json({ success: true, data: results, meta })
}

export async function POST(request: Request) {
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as Partial<ApolloSearchFilters> & {
    searchId?: string
    limit?: number
  }

  try {
    const { results, meta } = await searchProspects(session.accountId, body, {
      searchId: body.searchId,
      persist: true,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
    })
    return NextResponse.json({
      success: true,
      data: results,
      meta,
    })
  } catch (error) {
    console.error('[aspire/search POST]', error)
    const [account] = await db
      .select({ vertical: accounts.vertical })
      .from(accounts)
      .where(eq(accounts.id, session.accountId))
      .limit(1)
    const fallback = fallbackSearchResults(
      session.accountId,
      body,
      account?.vertical ?? 'agency',
    )
    const message = error instanceof Error ? error.message : 'Search failed'
    fallback.meta.providerError = message
    fallback.meta.providerConfigured = isApifyConfigured()
    return NextResponse.json({
      success: true,
      data: fallback.results,
      meta: fallback.meta,
    })
  }
}
