import { getAdminSession } from '@/lib/auth/session'
import { findPendingDrafts } from '@/lib/aspire/queries'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const rows = await findPendingDrafts(session.accountId)
  const data = rows.map(({ draft, lead }) => ({
    ...draft,
    lead: {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      email: lead.email,
    },
  }))

  return NextResponse.json({ success: true, data })
}
