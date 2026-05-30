import { getAdminSession } from '@/lib/auth/session'
import { searchProspects } from '@/lib/aspire/search'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const data = await searchProspects(session.accountId, {
    q: searchParams.get('q'),
    company: searchParams.get('company'),
  })

  return NextResponse.json({ success: true, data })
}
