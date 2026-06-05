import { getAdminSession } from '@/lib/auth/session'
import { issueLinkedInExtensionToken } from '@/lib/linkedin/accounts'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const issued = await issueLinkedInExtensionToken(session.accountId, session.userId)

  return NextResponse.json({
    success: true,
    data: {
      token: issued.token,
      prefix: issued.prefix,
      linkedinAccountId: issued.linkedinAccountId,
    },
  })
}
