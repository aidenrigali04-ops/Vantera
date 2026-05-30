import { getAdminSession } from '@/lib/auth/session'
import { bulkUpdateLeads } from '@/lib/leads/actions'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const leadIds = Array.isArray(body.leadIds) ? body.leadIds : []
  const result = await bulkUpdateLeads(leadIds, {
    relationshipStatus: body.relationshipStatus,
    ownerId: body.ownerId,
  })

  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}
