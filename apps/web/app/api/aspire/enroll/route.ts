import { EnrollError, enrollLeadFromAspire } from '@/lib/aspire/enroll'
import type { ApolloPersonResult } from '@/lib/aspire/types'
import { getAdminSession } from '@/lib/auth/session'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as {
    person: ApolloPersonResult
    searchId?: string
    pipelineStage?: string
  }

  if (!body.person?.organizationName && !body.person?.id) {
    return NextResponse.json({ success: false, error: 'Invalid prospect data' }, { status: 400 })
  }

  try {
    const data = await enrollLeadFromAspire(
      body.person,
      body.searchId ?? '',
      body.pipelineStage ?? 'prospect',
    )
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof EnrollError) {
      const status = error.code === 'ALREADY_ENROLLED' ? 409 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    return NextResponse.json({ success: false, error: 'Enrollment failed' }, { status: 500 })
  }
}
