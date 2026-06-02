import { findSavedSearches } from '@/lib/aspire/queries'
import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { runUnboundSearch } from '@/lib/prospect-scout/run-search'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { searchId?: string }
  if (!body.searchId) {
    return NextResponse.json({ success: false, error: 'searchId is required' }, { status: 400 })
  }

  const searches = await findSavedSearches(session.accountId)
  const search = searches.find((item) => item.id === body.searchId)
  if (!search) {
    return NextResponse.json({ success: false, error: 'Search not found' }, { status: 404 })
  }

  const [account] = await db
    .select({ vertical: accounts.vertical })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  try {
    const result = await runUnboundSearch({
      search,
      accountId: session.accountId,
      vertical: account?.vertical ?? 'agency',
      config: null,
    })

    if (result.status === 'failed') {
      return NextResponse.json(
        { success: false, error: result.errorMessage ?? 'Apify search failed' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Apify search failed',
        code: 'APIFY_SEARCH_FAILED',
      },
      { status: 502 },
    )
  }
}
