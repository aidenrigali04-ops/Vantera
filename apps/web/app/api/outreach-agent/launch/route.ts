import { getAdminSession } from '@/lib/auth/session'
import { launchOutreachAgent } from '@/lib/outreach-agent/config'
import type { LaunchOutreachAgentInput } from '@/lib/outreach-agent/types'
import { SdrNotEnabledError } from '@/lib/sdr/guard'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as LaunchOutreachAgentInput
    const result = await launchOutreachAgent(body)
    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof SdrNotEnabledError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Launch failed'
    return NextResponse.json({ success: false, error: message }, { status: 403 })
  }
}
