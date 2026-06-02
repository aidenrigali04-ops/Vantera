import { enrollAspireProspectsInCampaign } from '@/lib/aspire/enroll-campaign'
import type { ApifyLead } from '@/lib/aspire/types'
import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    campaignId: string
    people: ApifyLead[]
    searchId?: string
  }

  if (!body.campaignId) {
    return NextResponse.json({ success: false, error: 'campaignId is required' }, { status: 400 })
  }

  const result = await enrollAspireProspectsInCampaign(body)
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, data: result.data }, { status: 201 })
}
