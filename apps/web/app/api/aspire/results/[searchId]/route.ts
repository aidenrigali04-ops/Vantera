import { findAspireResults } from '@/lib/aspire/queries'
import { hydrateAspireSearchResult } from '@/lib/aspire/hydrate-result'
import { getAdminSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

type RouteParams = { params: Promise<{ searchId: string }> }

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchId } = await params
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  const rows = await findAspireResults(session.accountId, searchId, limit, offset)

  const data = rows.map((row) => hydrateAspireSearchResult(row))

  return NextResponse.json({ success: true, data })
}
