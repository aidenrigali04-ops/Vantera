import { getAdminSession } from '@/lib/auth/session'
import {
  draftCampaignMessage,
  enrollLeadsInCampaign,
  launchOutreachCampaign,
  pauseOutreachCampaign,
  saveCampaignMessage,
} from '@/lib/outreach/actions'
import { findCampaignEnrollments, findOutreachCampaignById } from '@/lib/outreach/queries'
import { NextResponse } from 'next/server'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const campaign = await findOutreachCampaignById(session.accountId, id)
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const enrollments = await findCampaignEnrollments(session.accountId, id)
  return NextResponse.json({ success: true, data: { campaign, enrollments } })
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const body = await request.json()
  const action = body.action as string

  if (action === 'save_message') {
    const result = await saveCampaignMessage({
      campaignId: id,
      subject: body.subject ?? '',
      body: body.body ?? '',
      intent: body.intent,
    })
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  if (action === 'enroll_leads') {
    const result = await enrollLeadsInCampaign(id, body.leadIds ?? [])
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  if (action === 'launch') {
    const result = await launchOutreachCampaign(id)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  if (action === 'pause') {
    const result = await pauseOutreachCampaign(id)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  if (action === 'draft_message') {
    const result = await draftCampaignMessage(id, body.leadId ?? '', body.stepIndex ?? 0, {
      writerNotes: typeof body.writerNotes === 'string' ? body.writerNotes : undefined,
    })
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  }

  return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
}
