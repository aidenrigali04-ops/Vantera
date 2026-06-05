import { getAdminSession } from '@/lib/auth/session'
import { markCampaignStepSentCore } from '@/lib/outreach/runner'
import { markSdrLinkedInStepSent } from '@/lib/sdr/mark-linkedin-step-sent'
import { NextResponse } from 'next/server'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = (await request.json()) as { source?: 'campaign' | 'sdr_sequence' }

  if (body.source === 'sdr_sequence') {
    const result = await markSdrLinkedInStepSent({
      accountId: session.accountId,
      stepId: id,
      actorUserId: session.userId,
    })
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, data: { stepId: id } })
  }

  const result = await markCampaignStepSentCore(session.accountId, id, session.userId)
  if (!result.ok) {
    const messages: Record<string, string> = {
      step_not_found: 'Step not found',
      already_sent: 'Step already marked as sent',
      step_not_ready: 'This LinkedIn message is not ready to send yet',
    }
    return NextResponse.json(
      { success: false, error: messages[result.reason] ?? 'Could not mark step sent' },
      { status: 400 },
    )
  }

  return NextResponse.json({ success: true, data: { stepId: id, campaignId: result.campaignId } })
}
