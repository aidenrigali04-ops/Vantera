import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { searchProspects } from '@/lib/aspire/search'
import type { ApolloSearchFilters } from '@/lib/aspire/types'
import { NextResponse } from 'next/server'

/** Apify sync runs can take several minutes. */
export const maxDuration = 300

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

  const { results, meta } = await searchProspects(session.accountId, filters, { persist: true })
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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed — check APIFY_API_TOKEN in environment variables',
        code: 'APIFY_SEARCH_FAILED',
      },
      { status: 502 },
    )
  }
}
