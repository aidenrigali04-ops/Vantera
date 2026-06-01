import { getAdminSession } from '@/lib/auth/session'
import { findLeads } from '@/lib/leads/queries'
import { leadsToCsv } from '@/lib/leads/export-csv'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const idsParam = new URL(request.url).searchParams.get('ids')
  const ids = idsParam
    ? idsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined

  const rows = await findLeads(session.accountId, { ids, limit: 5000 })
  const csv = leadsToCsv(rows)
  const filename = `pipeline-leads-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
