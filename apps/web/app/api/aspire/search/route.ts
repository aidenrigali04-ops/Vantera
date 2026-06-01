import { getAdminSession } from '@/lib/auth/session'
import { searchProspects } from '@/lib/aspire/search'
import type { ApolloSearchFilters } from '@/lib/aspire/types'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
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

  const data = await searchProspects(session.accountId, filters, { persist: true })
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as ApolloSearchFilters & { searchId?: string }
  const filters: ApolloSearchFilters = {
    jobTitles: body.jobTitles ?? [],
    industries: body.industries ?? [],
    companySizeRanges: body.companySizeRanges ?? [],
    locations: body.locations ?? [],
    keywords: body.keywords,
    contactEmailStatus: body.contactEmailStatus,
    q: body.q,
    company: body.company,
  }

  try {
    const data = await searchProspects(session.accountId, filters, {
      searchId: body.searchId,
      persist: true,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed — Apollo API key may need updating',
        code: 'APOLLO_SEARCH_FAILED',
      },
      { status: 502 },
    )
  }
}
