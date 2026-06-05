import { getAdminSession } from '@/lib/auth/session'
import { getExtensionConnectionStatus } from '@/lib/extension/linkedin/status'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const status = await getExtensionConnectionStatus(session.accountId, session.userId)

  return NextResponse.json({ success: true, data: status })
}
