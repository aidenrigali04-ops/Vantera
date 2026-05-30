import { getAdminSession } from '@/lib/auth/session'
import { createLead } from '@/lib/leads/actions'
import { findLeads } from '@/lib/leads/queries'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const data = await findLeads(session.accountId, {
    search: searchParams.get('search') ?? undefined,
    source: searchParams.get('source') ?? undefined,
    relationshipStatus: searchParams.get('status') ?? undefined,
    ownerId: searchParams.get('ownerId') ?? undefined,
    limit: Number(searchParams.get('limit') ?? 50),
    offset: Number(searchParams.get('offset') ?? 0),
  })

  return NextResponse.json({ success: true, data })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const result = await createLead(body)
  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
