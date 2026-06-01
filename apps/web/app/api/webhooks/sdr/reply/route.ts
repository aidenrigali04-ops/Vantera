import { handleSdrReply } from '@/lib/sdr/reply-handler'
import { parseStepIdFromAddresses } from '@/lib/outreach/reply-address'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      stepId?: string
      resendId?: string
      twilioSid?: string
      bodyPreview?: string
      to?: string[]
      from?: string
    }

    const stepId =
      body.stepId ??
      (body.to ? parseStepIdFromAddresses(body.to) : null) ??
      undefined

    const result = await handleSdrReply({
      stepId,
      resendId: body.resendId,
      twilioSid: body.twilioSid,
      bodyPreview: body.bodyPreview,
      fromEmail: body.from,
    })

    return NextResponse.json({ success: true, data: result })
  } catch {
    return NextResponse.json({ success: true, data: { handled: false } })
  }
}
