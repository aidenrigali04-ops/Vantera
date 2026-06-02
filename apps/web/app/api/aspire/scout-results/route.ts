import { findProspectScoutResults } from '@/lib/aspire/queries'
import { hydrateAspireSearchResult } from '@/lib/aspire/hydrate-result'
import { getAdminSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  const rows = await findProspectScoutResults(session.accountId, limit, offset)

  const data = rows.map((row) =>
    hydrateAspireSearchResult(row, { source: 'prospect_scout' as const }),
  )

  return NextResponse.json({ success: true, data })
}
