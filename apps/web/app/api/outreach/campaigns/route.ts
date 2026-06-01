import { getAdminSession } from '@/lib/auth/session'
import { createOutreachCampaign } from '@/lib/outreach/actions'
import { findOutreachCampaigns } from '@/lib/outreach/queries'
import type { OutreachCampaignGoal } from '@/lib/outreach/types'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const data = await findOutreachCampaigns(session.accountId)
  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { name?: string; goal?: OutreachCampaignGoal }
  const result = await createOutreachCampaign({
    name: body.name ?? 'Untitled campaign',
    goal: body.goal ?? 'book_meeting',
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
