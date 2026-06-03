import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { activities, messages, outreachCampaignSteps, sdrSequenceSteps } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function handleEmailOpened(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  const resendId = data.email_id
  if (!resendId) return { handled: false, detail: 'missing_email_id' }

  const outbound = await findOutboundByResendId(resendId)
  if (!outbound) return { handled: false, detail: 'outbound_not_found' }

  const ownerId = await resolveAccountOwnerId(outbound.accountId)
  if (!ownerId) return { handled: false, detail: 'no_active_owner' }

  if (outbound.kind === 'message') {
    await db
      .update(messages)
      .set({ readAt: new Date(), status: 'read' })
      .where(eq(messages.id, outbound.messageId))

    await db.insert(activities).values({
      accountId: outbound.accountId,
      contactId: outbound.contactId,
      recordId: outbound.recordId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_opened',
      body: `Email opened — ${outbound.contactFirstName} ${outbound.contactLastName}`,
      metadata: { resendId, messageId: outbound.messageId },
      visibleToClient: false,
    })

    return { handled: true, detail: 'message_opened' }
  }

  if (outbound.kind === 'sdr_step') {
    await db
      .update(sdrSequenceSteps)
      .set({ openedAt: new Date() })
      .where(eq(sdrSequenceSteps.id, outbound.stepId))

    return { handled: true, detail: 'sdr_step_opened' }
  }

  const [existingStep] = await db
    .select({ metadata: outreachCampaignSteps.metadata })
    .from(outreachCampaignSteps)
    .where(eq(outreachCampaignSteps.id, outbound.stepId))
    .limit(1)

  await db
    .update(outreachCampaignSteps)
    .set({
      metadata: {
        ...((existingStep?.metadata as Record<string, unknown> | undefined) ?? {}),
        openedAt: new Date().toISOString(),
        resendId,
      },
    })
    .where(eq(outreachCampaignSteps.id, outbound.stepId))

  return { handled: true, detail: 'campaign_step_opened' }
}
