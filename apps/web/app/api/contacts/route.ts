import { getAdminSession } from '@/lib/auth/session'
import { findContacts } from '@/lib/db/queries'
import { contacts } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') ?? undefined
  const type = searchParams.get('type') ?? undefined
  const tags = searchParams.get('tags')?.split(',').filter(Boolean)
  const atRisk = searchParams.get('atRisk') === 'true'
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  const data = await findContacts(session.accountId, {
    search,
    type: type && type !== 'all' ? type : undefined,
    tags,
    limit,
    offset,
  })

  let filtered = data
  if (atRisk) {
    filtered = data.filter((c) => c.churnRiskScore > 70)
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(and(eq(contacts.accountId, session.accountId), isNull(contacts.deletedAt)))

  return NextResponse.json({
    success: true,
    data: filtered,
    meta: {
      total: countRow?.count ?? 0,
      page: Math.floor(offset / limit) + 1,
      perPage: limit,
    },
  })
}
