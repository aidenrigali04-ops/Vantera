import { getAdminSession } from '@/lib/auth/session'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { SdrSendBlockedError, sendSdrSequenceStepNow } from '@/lib/sdr/send-single-step'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const { id } = await params
    await sendSdrSequenceStepNow({ accountId: session.accountId, stepId: id })
    return NextResponse.json({ success: true, data: { sent: true } })
  } catch (error) {
    if (error instanceof SdrSendBlockedError) {
      const status =
        error.code === 'SDR_CREDITS_EXHAUSTED'
          ? 402
          : error.code === 'NOT_FOUND'
            ? 404
            : 400
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status },
      )
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      },
      { status: 500 },
    )
  }
}
