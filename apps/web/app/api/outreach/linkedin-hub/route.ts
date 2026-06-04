import { getAdminSession } from '@/lib/auth/session'
import { getLinkedInOutreachHubSnapshot } from '@/lib/outreach/linkedin-hub'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await getLinkedInOutreachHubSnapshot(session.accountId, session.userId)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Could not load LinkedIn outreach hub',
      },
      { status: 500 },
    )
  }
}
