import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { listSdrSequences } from '@/lib/sdr/queries'
import { sdrSequenceSteps, sdrSequences } from '@vantera/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const params = new URL(request.url).searchParams
    const status = params.get('status') ?? 'all'
    const rows = await listSdrSequences(session.accountId, {
      status,
      limit: Number(params.get('limit') ?? '50'),
      offset: Number(params.get('offset') ?? '0'),
    })
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}

export async function DELETE(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const body = (await request.json()) as { sequenceIds?: string[] }
    const ids = body.sequenceIds ?? []
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'No sequences selected' }, { status: 400 })
    }

    const now = new Date()
    await db
      .update(sdrSequences)
      .set({ status: 'cancelled', deletedAt: now })
      .where(
        and(
          eq(sdrSequences.accountId, session.accountId),
          inArray(sdrSequences.id, ids),
          isNull(sdrSequences.deletedAt),
        ),
      )

    await db
      .update(sdrSequenceSteps)
      .set({ status: 'cancelled', deletedAt: now })
      .where(
        and(
          eq(sdrSequenceSteps.accountId, session.accountId),
          inArray(sdrSequenceSteps.sequenceId, ids),
          eq(sdrSequenceSteps.status, 'scheduled'),
        ),
      )

    return NextResponse.json({ success: true, data: { cancelled: ids.length } })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
