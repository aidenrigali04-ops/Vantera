import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { activities, messages } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function handleEmailComplained(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  const resendId = data.email_id
  if (!resendId) return { handled: false, detail: 'missing_email_id' }

  const outbound = await findOutboundByResendId(resendId)
  if (!outbound) return { handled: false, detail: 'outbound_not_found' }

  if (outbound.kind !== 'message') {
    return { handled: false, detail: 'campaign_complaint_not_tracked_yet' }
  }

  const ownerId = await resolveAccountOwnerId(outbound.accountId)
  if (!ownerId) return { handled: false, detail: 'no_active_owner' }

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
    activityType: 'email_complained',
    body: 'Spam complaint received',
    metadata: { resendId, messageId: outbound.messageId },
    visibleToClient: false,
  })

  await createIntelligenceSignal({
    accountId: outbound.accountId,
    contactId: outbound.contactId,
    recordId: outbound.recordId,
    signalType: 'email_complained',
    severity: 'red',
    headline: 'Spam complaint — remove from outreach',
    recommendation: 'Stop messaging this contact immediately.',
    actionLabel: 'View contact',
    actionPayload: { contactId: outbound.contactId },
    expiresInDays: 30,
  })

  return { handled: true, detail: 'message_complained' }
}
