import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { activities, messages } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function handleEmailBounced(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  const resendId = data.email_id
  if (!resendId) return { handled: false, detail: 'missing_email_id' }

  const outbound = await findOutboundByResendId(resendId)
  if (!outbound) return { handled: false, detail: 'outbound_not_found' }

  const ownerId = await resolveAccountOwnerId(outbound.accountId)
  if (!ownerId) return { handled: false, detail: 'no_active_owner' }

  const bounceMessage = data.bounce?.message ?? 'Email bounced'

  if (outbound.kind === 'message') {
    await db
      .update(messages)
      .set({ status: 'failed' })
      .where(eq(messages.id, outbound.messageId))

    await db.insert(activities).values({
      accountId: outbound.accountId,
      contactId: outbound.contactId,
      recordId: outbound.recordId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_bounced',
      body: bounceMessage,
      metadata: { resendId, messageId: outbound.messageId },
      visibleToClient: false,
    })

    const company = outbound.company ?? `${outbound.contactFirstName} ${outbound.contactLastName}`

    await createIntelligenceSignal({
      accountId: outbound.accountId,
      contactId: outbound.contactId,
      recordId: outbound.recordId,
      signalType: 'email_bounced',
      severity: 'red',
      headline: `Email bounced for ${company} — update contact`,
      recommendation: 'Verify the email address before sending again.',
      actionLabel: 'Edit contact',
      actionPayload: { contactId: outbound.contactId },
      expiresInDays: 30,
    })

    return { handled: true, detail: 'message_bounced' }
  }

  return { handled: false, detail: 'campaign_bounce_not_tracked_yet' }
}
