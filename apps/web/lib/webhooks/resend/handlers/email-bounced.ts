import { db } from '@/lib/db/client'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { findOutboundByResendId } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import type { ResendHandlerResult, ResendWebhookEventData } from '@/lib/webhooks/resend/types'
import { findLeadDisplayName } from '@/lib/webhooks/resend/queries'
import {
  activities,
  leads,
  messages,
  outreachCampaignSteps,
  sdrSequenceSteps,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'

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

  if (outbound.kind === 'sdr_step') {
    await db
      .update(sdrSequenceSteps)
      .set({ status: 'failed' })
      .where(eq(sdrSequenceSteps.id, outbound.stepId))

    const leadName = await findLeadDisplayName(outbound.accountId, outbound.leadId)
    await db.insert(activities).values({
      accountId: outbound.accountId,
      leadId: outbound.leadId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_bounced',
      body: `${bounceMessage} — ${leadName}`,
      metadata: { resendId, stepId: outbound.stepId, sequenceId: outbound.sequenceId },
    })

    return { handled: true, detail: 'sdr_step_bounced' }
  }

  await db
    .update(outreachCampaignSteps)
    .set({ status: 'failed', skipReason: bounceMessage })
    .where(eq(outreachCampaignSteps.id, outbound.stepId))

  const [lead] = await db
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.id, outbound.leadId), eq(leads.accountId, outbound.accountId)))
    .limit(1)

  if (lead) {
    const leadName = await findLeadDisplayName(outbound.accountId, outbound.leadId)
    await db.insert(activities).values({
      accountId: outbound.accountId,
      leadId: outbound.leadId,
      actorType: 'automation',
      actorId: ownerId,
      activityType: 'email_bounced',
      body: `${bounceMessage} — ${leadName}`,
      metadata: {
        resendId,
        stepId: outbound.stepId,
        campaignId: outbound.campaignId,
      },
    })
  }

  return { handled: true, detail: 'campaign_step_bounced' }
}
