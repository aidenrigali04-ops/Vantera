import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { findLeadDisplayName } from '@/lib/webhooks/resend/queries'
import { activities, messages, outreachCampaignSteps, sdrSequenceSteps } from '@vantera/db'
import { eq } from 'drizzle-orm'

export async function handleEmailClicked(
  data: ResendWebhookEventData,
): Promise<ResendHandlerResult> {
  const resendId = data.email_id
  if (!resendId) return { handled: false, detail: 'missing_email_id' }

  const outbound = await findOutboundByResendId(resendId)
  if (!outbound) return { handled: false, detail: 'outbound_not_found' }

  const ownerId = await resolveAccountOwnerId(outbound.accountId)
  if (!ownerId) return { handled: false, detail: 'no_active_owner' }

  const clickUrl = data.click?.link ?? null

  if (outbound.kind === 'sdr_step') {
    await db
      .update(sdrSequenceSteps)
      .set({ clickedAt: new Date() })
      .where(eq(sdrSequenceSteps.id, outbound.stepId))

    const leadName = await findLeadDisplayName(outbound.accountId, outbound.leadId)
    await db.insert(activities).values({
      accountId: outbound.accountId,
      leadId: outbound.leadId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_clicked',
      body: `${leadName} clicked your outreach email`,
      metadata: { resendId, stepId: outbound.stepId, url: clickUrl },
    })

    return { handled: true, detail: 'sdr_step_clicked' }
  }

  if (outbound.kind === 'campaign_step') {
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
          clickedAt: new Date().toISOString(),
          clickUrl,
          resendId,
        },
      })
      .where(eq(outreachCampaignSteps.id, outbound.stepId))

    const leadName = await findLeadDisplayName(outbound.accountId, outbound.leadId)
    await db.insert(activities).values({
      accountId: outbound.accountId,
      leadId: outbound.leadId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_clicked',
      body: `${leadName} clicked a campaign email`,
      metadata: {
        resendId,
        stepId: outbound.stepId,
        campaignId: outbound.campaignId,
        url: clickUrl,
      },
    })

    return { handled: true, detail: 'campaign_step_clicked' }
  }

  if (outbound.kind !== 'message') {
    return { handled: false, detail: 'unknown_outbound_kind' }
  }

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
