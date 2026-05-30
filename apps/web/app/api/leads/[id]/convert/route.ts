import { getAdminSession } from '@/lib/auth/session'
import { convertLeadToClient } from '@/lib/leads/convert'
import { NextResponse } from 'next/server'

type Props = { params: { id: string } }

export async function POST(_request: Request, { params }: Props) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const result = await convertLeadToClient(params.id)
  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}
