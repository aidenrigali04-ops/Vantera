import { getAdminSession } from '@/lib/auth/session'
import { getSdrProfile, patchSdrProfile, type SdrProfilePatch } from '@/lib/sdr/profile'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const data = await getSdrProfile(session.accountId)
  return NextResponse.json({ success: true, data })
}

export async function PATCH(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as SdrProfilePatch
  const result = await patchSdrProfile(session.accountId, body)

  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}
