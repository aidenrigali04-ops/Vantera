// POST /api/webhooks/resend
// Resend inbound + delivery events. Signature verified via RESEND_WEBHOOK_SECRET.
// See .cursor/phase-2-sales-intelligence.md (FILE 10) for full spec.

import { handleResendWebhookEvent } from '@/lib/webhooks/resend/handle-event'
import type { ResendWebhookEvent } from '@/lib/webhooks/resend/types'
import { verifyResendWebhook } from '@/lib/webhooks/resend/verify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const payload = await req.text()

  let event: ResendWebhookEvent
  try {
    event = verifyResendWebhook(payload, req.headers)
  } catch (error) {
    console.error('[resend-webhook] verification failed:', error)
    return Response.json(
      { success: false, error: 'invalid_signature', code: 'INVALID_SIGNATURE' },
      { status: 400 },
    )
  }

  try {
    const result = await handleResendWebhookEvent(event)
    return Response.json({
      success: true,
      data: {
        type: event.type,
        handled: result.handled,
        detail: result.detail,
      },
    })
  } catch (error) {
    console.error('[resend-webhook] handler failed:', error)
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'handler_failed',
      },
      { status: 500 },
    )
  }
}
