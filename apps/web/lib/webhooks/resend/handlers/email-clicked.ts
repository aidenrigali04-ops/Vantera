import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { activities, messages } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function handleEmailClicked(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  const resendId = data.email_id
  if (!resendId) return { handled: false, detail: 'missing_email_id' }

  const outbound = await findOutboundByResendId(resendId)
  if (!outbound) return { handled: false, detail: 'outbound_not_found' }

  if (outbound.kind !== 'message') {
    return { handled: false, detail: 'campaign_click_not_tracked_yet' }
  }

  const ownerId = await resolveAccountOwnerId(outbound.accountId)
  if (!ownerId) return { handled: false, detail: 'no_active_owner' }

  const clickUrl = data.click?.link ?? null

  const [existing] = await db
    .select({ metadata: messages.metadata })
    .from(messages)
    .where(eq(messages.id, outbound.messageId))
    .limit(1)

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | undefined) ?? {}),
    clickedAt: new Date().toISOString(),
    clickUrl,
    resendId,
  }

  await db.update(messages).set({ metadata }).where(eq(messages.id, outbound.messageId))

  await db.insert(activities).values({
    accountId: outbound.accountId,
    contactId: outbound.contactId,
    recordId: outbound.recordId,
    actorType: 'automation',
    actorId: ownerId,
    activityType: 'email_clicked',
    body: `${outbound.contactFirstName} clicked your email`,
    metadata: { resendId, messageId: outbound.messageId, url: clickUrl },
    visibleToClient: false,
  })

  await createIntelligenceSignal({
    accountId: outbound.accountId,
    contactId: outbound.contactId,
    recordId: outbound.recordId,
    signalType: 'email_clicked',
    severity: 'yellow',
    headline: `${outbound.contactFirstName} clicked your email — follow up now`,
    recommendation: 'Strike while interest is high.',
    actionLabel: 'View contact',
    actionPayload: { contactId: outbound.contactId, recordId: outbound.recordId },
    expiresInDays: 3,
  })

  return { handled: true, detail: 'message_clicked' }
}
