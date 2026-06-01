import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { getSdrSequenceDetail } from '@/lib/sdr/queries'
import { sdrSequenceSteps, sdrSequences } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const { id } = await params
    const detail = await getSdrSequenceDetail(session.accountId, id)
    if (!detail) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const { id } = await params
    const now = new Date()

    await db
      .update(sdrSequences)
      .set({ status: 'cancelled', deletedAt: now })
      .where(
        and(
          eq(sdrSequences.id, id),
          eq(sdrSequences.accountId, session.accountId),
          isNull(sdrSequences.deletedAt),
        ),
      )

    await db
      .update(sdrSequenceSteps)
      .set({ status: 'cancelled', deletedAt: now })
      .where(
        and(
          eq(sdrSequenceSteps.sequenceId, id),
          eq(sdrSequenceSteps.accountId, session.accountId),
          eq(sdrSequenceSteps.status, 'scheduled'),
        ),
      )

    return NextResponse.json({ success: true, data: undefined })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
