import { requireAdminSession } from '@/lib/auth/require-session'
import { findUnipileLinkedInAccount, refreshUnipileConnectionStatus } from '@/lib/integrations/unipile/account'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await requireAdminSession().catch(() => null)
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const row = await findUnipileLinkedInAccount(session.accountId, session.userId)

  if (!row?.unipileAccountId) {
    return NextResponse.json({
      success: true,
      data: { connected: false, status: 'not_configured' },
    })
  }

  // Refresh from Unipile on every status check so the UI always reflects live state
  const { connected, status } = await refreshUnipileConnectionStatus(
    session.accountId,
    session.userId,
  )

  return NextResponse.json({
    success: true,
    data: {
      connected,
      status,
      unipileAccountId: row.unipileAccountId,
      connectedAt: row.unipileConnectedAt?.toISOString() ?? null,
      lastError: row.unipileLastError ?? null,
    },
  })
}
