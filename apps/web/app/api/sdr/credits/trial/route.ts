import { getAdminSession } from '@/lib/auth/session'
import { getSdrCreditStatus, startSdrTrial } from '@/lib/sdr/credits'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const before = await getSdrCreditStatus(session.accountId)
    if (before.trialActive) {
      return NextResponse.json({ success: true, data: before })
    }
    if (before.trialEndsAt) {
      return NextResponse.json(
        { success: false, error: 'Your free trial has already been used', code: 'TRIAL_USED' },
        { status: 409 },
      )
    }

    const status = await startSdrTrial(session.accountId)
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
