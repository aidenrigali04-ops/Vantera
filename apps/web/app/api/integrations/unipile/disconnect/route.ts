import { requireAdminSession } from '@/lib/auth/require-session'
import { disconnectUnipileAccount } from '@/lib/integrations/unipile/account'
import { NextResponse } from 'next/server'

export async function POST() {
  const session = await requireAdminSession().catch(() => null)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const result = await disconnectUnipileAccount(session.accountId, session.userId, {
    deleteFromUnipile: true,
  })

  if (!result.ok) {
    return NextResponse.json({ success: false, error: 'No LinkedIn account found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
