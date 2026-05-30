import { getAdminSession } from '@/lib/auth/session'
import { addAspireResultToPipeline, type AspireSearchResult } from '@/lib/aspire/search'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as AspireSearchResult
  if (!body.company) {
    return NextResponse.json({ success: false, error: 'Company is required' }, { status: 400 })
  }

  const lead = await addAspireResultToPipeline(session.accountId, session.userId, body)
  return NextResponse.json({ success: true, data: { id: lead.id } }, { status: 201 })
}
