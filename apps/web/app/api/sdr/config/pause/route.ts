import { getAdminSession } from '@/lib/auth/session'
import { pauseSDRAgent, resumeSDRAgent } from '@/lib/sdr/config'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const action = url.pathname.endsWith('/resume') ? 'resume' : 'pause'

  try {
    if (action === 'resume') {
      const result = await resumeSDRAgent()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    const result = await pauseSDRAgent(body.reason ?? 'Paused by admin')
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    const message = error instanceof SdrNotEnabledError ? error.message : 'Request failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
