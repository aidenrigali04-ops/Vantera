import { db } from '@/lib/db/client'
import { findOutreachCampaignById } from '@/lib/outreach/queries'
import { parseCampaignMetrics } from '@/lib/outreach/types'
import { findLeadDisplayName } from '@/lib/webhooks/resend/queries'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  activities,
  leads,
  outreachCampaignEnrollments,
  outreachCampaigns,
  outreachCampaignSteps,
} from '@vantera/db'
import { and, eq, sql } from 'drizzle-orm'

export type RecordCampaignReplyInput = {
  accountId: string
  enrollmentId: string
  campaignId: string
  leadId: string
  stepId?: string
  fromEmail: string
  subject?: string
  bodyPreview?: string
  inboundEmailId?: string
  actorUserId: string
}

export type RecordCampaignReplyResult =
  | { ok: true; alreadyRecorded: boolean }
  | { ok: false; reason: string }

export async function recordCampaignInboundReply(
  input: RecordCampaignReplyInput,
): Promise<RecordCampaignReplyResult> {
  if (input.inboundEmailId) {
    const [existing] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(
        and(
          eq(activities.accountId, input.accountId),
          sql`${activities.metadata}->>'inboundEmailId' = ${input.inboundEmailId}`,
        ),
      )
      .limit(1)

    if (existing) {
      return { ok: true, alreadyRecorded: true }
    }
  }

  const [enrollment] = await db
    .select()
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.id, input.enrollmentId),
        eq(outreachCampaignEnrollments.accountId, input.accountId),
      ),
    )
    .limit(1)

  if (!enrollment) {
    return { ok: false, reason: 'enrollment_not_found' }
  }

  if (enrollment.status === 'replied' || enrollment.status === 'completed') {
    return { ok: true, alreadyRecorded: true }
  }

  await db
    .update(outreachCampaignEnrollments)
    .set({ status: 'replied', repliedAt: new Date(), updatedAt: new Date() })
    .where(eq(outreachCampaignEnrollments.id, input.enrollmentId))

  const campaign = await findOutreachCampaignById(input.accountId, input.campaignId)
  if (campaign) {
    const metrics = parseCampaignMetrics(campaign.metrics)
    metrics.replied += 1
    await db
      .update(outreachCampaigns)
      .set({ metrics, updatedAt: new Date() })
      .where(eq(outreachCampaigns.id, input.campaignId))
  }

  await db
    .update(outreachCampaignSteps)
    .set({ status: 'cancelled', skipReason: 'lead_replied' })
    .where(
      and(
        eq(outreachCampaignSteps.enrollmentId, input.enrollmentId),
        eq(outreachCampaignSteps.status, 'pending'),
      ),
    )

  const [lead] = await db
    .select({ relationshipStatus: leads.relationshipStatus })
    .from(leads)
    .where(and(eq(leads.id, input.leadId), eq(leads.accountId, input.accountId)))
    .limit(1)

  if (
    lead &&
    (lead.relationshipStatus === 'contacted' || lead.relationshipStatus === 'connected')
  ) {
    await db
      .update(leads)
      .set({ relationshipStatus: 'nurturing', updatedAt: new Date() })
      .where(eq(leads.id, input.leadId))
  }

  const preview =
    input.bodyPreview?.trim().slice(0, 240) ||
    input.subject?.trim().slice(0, 120) ||
    'Reply received'

  await db.insert(activities).values({
    accountId: input.accountId,
    leadId: input.leadId,
    actorType: 'automation',
    actorId: input.actorUserId,
    activityType: 'email_reply',
    body: `${input.fromEmail} replied: ${preview}`,
    metadata: {
      campaignId: input.campaignId,
      enrollmentId: input.enrollmentId,
      stepId: input.stepId,
      inboundEmailId: input.inboundEmailId,
      subject: input.subject,
    },
  })

  const leadName = await findLeadDisplayName(input.accountId, input.leadId)

  await createIntelligenceSignal({
    accountId: input.accountId,
    signalType: 'email_replied',
    severity: 'green',
    headline: `${leadName} replied to your campaign`,
    recommendation: 'Review the reply and book a meeting while interest is high.',
    actionLabel: 'View campaign',
    actionPayload: {
      campaignId: input.campaignId,
      leadId: input.leadId,
      enrollmentId: input.enrollmentId,
    },
    expiresInDays: 7,
  })

  return { ok: true, alreadyRecorded: false }
}
