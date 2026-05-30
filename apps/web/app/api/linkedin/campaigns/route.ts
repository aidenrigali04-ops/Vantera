import { getAdminSession } from '@/lib/auth/session'
import { createCampaign } from '@/lib/linkedin/actions'
import { findCampaigns } from '@/lib/linkedin/queries'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const data = await findCampaigns(session.accountId)
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = await createCampaign(body.name ?? 'Untitled campaign')
  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
