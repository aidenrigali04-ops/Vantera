import { getAdminSession } from '@/lib/auth/session'
import { getSdrCreditStatus } from '@/lib/sdr/credits'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const status = await getSdrCreditStatus(session.accountId)
    return NextResponse.json({ success: true, data: status })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
