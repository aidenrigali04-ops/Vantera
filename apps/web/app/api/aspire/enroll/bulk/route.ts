import { bulkEnrollFromAspire } from '@/lib/aspire/enroll'
import type { ApifyLead } from '@/lib/aspire/types'
import { getSyncedAdminSession } from '@/lib/auth/require-session'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getSyncedAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    people: ApifyLead[]
    searchId?: string
    pipelineStage?: string
  }

  if (!Array.isArray(body.people) || body.people.length === 0) {
    return NextResponse.json({ success: false, error: 'No prospects provided' }, { status: 400 })
  }

  const data = await bulkEnrollFromAspire(
    body.people,
    body.searchId ?? '',
    body.pipelineStage ?? 'prospect',
  )

  return NextResponse.json({ success: true, data })
}
