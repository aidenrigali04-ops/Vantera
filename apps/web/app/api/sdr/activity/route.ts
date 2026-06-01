import { getAdminSession } from '@/lib/auth/session'
import { requireSDREnabled } from '@/lib/sdr/guard'
import { getSdrActivityFeed } from '@/lib/sdr/queries'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireSDREnabled()
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? '50')
    const events = await getSdrActivityFeed(session.accountId, limit)
    return NextResponse.json({ success: true, data: events })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Forbidden' },
      { status: 403 },
    )
  }
}
