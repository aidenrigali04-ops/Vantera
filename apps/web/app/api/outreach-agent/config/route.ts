import { getAdminSession } from '@/lib/auth/session'
import {
  pauseOutreachAgent,
  resumeOutreachAgent,
  runLinkedCampaignQueueNow,
  updateOutreachAgentConfig,
} from '@/lib/outreach-agent/config'
import { findOutreachAgentConfigByAccount } from '@/lib/outreach-agent/queries'
import type { UpdateOutreachAgentInput } from '@/lib/outreach-agent/types'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const config = await findOutreachAgentConfigByAccount(session.accountId)
  return NextResponse.json({ success: true, data: config })
}

export async function PUT(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as UpdateOutreachAgentInput
  const result = await updateOutreachAgentConfig(body)
  if (!result.success) {
    return NextResponse.json(result, { status: 400 })
  }
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json()) as { action?: string; reason?: string }
  switch (body.action) {
    case 'pause': {
      const result = await pauseOutreachAgent(body.reason)
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }
    case 'resume': {
      const result = await resumeOutreachAgent()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }
    case 'run_now': {
      const result = await runLinkedCampaignQueueNow()
      return NextResponse.json(result, { status: result.success ? 200 : 400 })
    }
    default:
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
  }
}
