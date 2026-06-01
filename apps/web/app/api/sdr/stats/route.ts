import { getAdminSession } from '@/lib/auth/session'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { getSdrDashboardStats } from '@/lib/sdr/queries'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const stats = await getSdrDashboardStats(session.accountId)
    return NextResponse.json({ success: true, data: stats })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
