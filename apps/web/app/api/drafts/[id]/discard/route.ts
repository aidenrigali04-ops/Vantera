import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { intelligenceSignals, leadDrafts } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const [draft] = await db
    .select()
    .from(leadDrafts)
    .where(
      and(
        eq(leadDrafts.id, id),
        eq(leadDrafts.accountId, session.accountId),
        isNull(leadDrafts.deletedAt),
      ),
    )
    .limit(1)

  if (!draft) {
    return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
  }

  if (draft.status !== 'pending_review') {
    return NextResponse.json(
      { success: false, error: 'Draft already processed' },
      { status: 409 },
    )
  }

  await db
    .update(leadDrafts)
    .set({ status: 'discarded' })
    .where(eq(leadDrafts.id, id))

  await db
    .update(intelligenceSignals)
    .set({ isDismissed: true })
    .where(
      and(
        eq(intelligenceSignals.accountId, session.accountId),
        eq(intelligenceSignals.isDismissed, false),
        eq(intelligenceSignals.signalType, 'draft_ready'),
        sql`${intelligenceSignals.actionPayload}->>'draftId' = ${id}`,
      ),
    )

  return NextResponse.json({ success: true, data: { draftId: id } })
}
