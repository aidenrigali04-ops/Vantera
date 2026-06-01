import { handleEmailBounced } from '@/lib/webhooks/resend/handlers/email-bounced'
import { handleEmailClicked } from '@/lib/webhooks/resend/handlers/email-clicked'
import { handleEmailComplained } from '@/lib/webhooks/resend/handlers/email-complained'
import { handleEmailOpened } from '@/lib/webhooks/resend/handlers/email-opened'
import { handleEmailReceived } from '@/lib/webhooks/resend/handlers/email-received'
import type { ResendHandlerResult, ResendWebhookEvent } from '@/lib/webhooks/resend/types'

export async function handleResendWebhookEvent(
  event: ResendWebhookEvent,
): Promise<ResendHandlerResult> {
  switch (event.type) {
    case 'email.received':
      return handleEmailReceived(event.data)
    case 'email.opened':
      return handleEmailOpened(event.data)
    case 'email.clicked':
      return handleEmailClicked(event.data)
    case 'email.bounced':
      return handleEmailBounced(event.data)
    case 'email.complained':
      return handleEmailComplained(event.data)
    default:
      return { handled: false, detail: `ignored:${event.type}` }
  }
}
