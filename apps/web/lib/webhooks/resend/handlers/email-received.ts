import { handleResendInboundEmail } from '@/lib/outreach/handle-inbound-email'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'

export async function handleEmailReceived(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  if (!data.email_id || !data.from || !Array.isArray(data.to)) {
    return { handled: false, detail: 'invalid_payload' }
  }

  const result = await handleResendInboundEmail({
    type: 'email.received',
    data: {
      email_id: String(data.email_id),
      from: String(data.from),
      to: data.to.map(String),
      subject: data.subject ? String(data.subject) : undefined,
      message_id: data.message_id ? String(data.message_id) : undefined,
    },
  })

  if (!result.ok) {
    throw new Error(result.reason)
  }

  return {
    handled: result.matched,
    detail: result.matched
      ? `campaign:${result.campaignId ?? result.stepId}`
      : 'no_campaign_match',
  }
}
