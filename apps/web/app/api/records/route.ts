import { getAdminSession } from '@/lib/auth/session'
import { findRecordWithRelations, findRecordsWithRelations } from '@/lib/db/queries'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const recordType = searchParams.get('recordType') ?? undefined
  const stageId = searchParams.get('stageId') ?? undefined
  const assignedUserId = searchParams.get('assignedUserId') ?? undefined
  const isPipeline = searchParams.get('isPipeline')
  const limit = Number(searchParams.get('limit') ?? 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  const data = await findRecordsWithRelations(session.accountId, {
    recordType,
    stageId,
    assignedUserId,
    isPipeline: isPipeline === null ? undefined : isPipeline === 'true',
    limit,
    offset,
  })

  return NextResponse.json({
    success: true,
    data,
    meta: { total: data.length },
  })
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(request.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })
  }

  const record = await findRecordWithRelations(session.accountId, id)
  if (!record) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: record })
}
