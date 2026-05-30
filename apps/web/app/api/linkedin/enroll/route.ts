import { getAdminSession } from '@/lib/auth/session'
import { enrollLeads } from '@/lib/linkedin/actions'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = await enrollLeads(body.campaignId, body.leadIds ?? [])
  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}
