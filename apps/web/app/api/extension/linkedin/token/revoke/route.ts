import { getAdminSession } from '@/lib/auth/session'
import { revokeLinkedInExtensionToken } from '@/lib/linkedin/accounts'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await revokeLinkedInExtensionToken(session.accountId, session.userId)
  if (!result.ok) {
    return NextResponse.json({ success: false, error: 'No LinkedIn connection record' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
