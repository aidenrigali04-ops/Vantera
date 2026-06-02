import { db } from '@/lib/db/client'
import { findDueCampaignSteps, findOutreachCampaignById } from '@/lib/outreach/queries'
import { sendCampaignEmail } from '@/lib/outreach/send-email'
import { sendCampaignSms } from '@/lib/outreach/send-sms'
import { personalizeTemplate, parseCampaignMetrics, type OutreachCampaignWorkflow } from '@/lib/outreach/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  activities,
  leads,
  outreachCampaignEnrollments,
  outreachCampaigns,
  outreachCampaignSteps,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'

export type ProcessDueStepsResult = {
  processed: number
  sent: number
  failed: number
  skipped: number
  manualReady: number
}

function leadDisplayName(lead: { firstName: string | null; lastName: string | null; company: string | null }) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ')
  return name || lead.company || 'Lead'
}

export async function processDueCampaignSteps(
  accountId: string,
  actorUserId: string,
  options?: { campaignIds?: string[] },
): Promise<ProcessDueStepsResult> {
  const dueSteps = await findDueCampaignSteps(accountId, 50, options?.campaignIds)
  const result: ProcessDueStepsResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    manualReady: 0,
  }

  if (dueSteps.length === 0) return result

  const [account] = await db
    .select({ name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const accountName = account?.name ?? 'Your team'

  for (const step of dueSteps) {
    result.processed += 1

    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, step.leadId), eq(leads.accountId, accountId)))
      .limit(1)

    if (!lead) {
      await db
        .update(outreachCampaignSteps)
        .set({ status: 'skipped', skipReason: 'lead_not_found' })
        .where(eq(outreachCampaignSteps.id, step.id))
      result.skipped += 1
      continue
    }

    if (step.channel === 'email') {
      if (!lead.email) {
        await db
          .update(outreachCampaignSteps)
          .set({ status: 'skipped', skipReason: 'missing_email' })
          .where(eq(outreachCampaignSteps.id, step.id))
        result.skipped += 1
        await incrementCampaignMetric(accountId, step.campaignId, 'failed')
        continue
      }

      const sendResult = await sendCampaignEmail({
        accountId,
        accountName,
        toEmail: lead.email,
        subject: step.subject ?? 'Hello from us',
        body: step.body,
        lead,
        stepId: step.id,
      })

      if (!sendResult.ok) {
        await db
          .update(outreachCampaignSteps)
          .set({ status: 'failed', skipReason: sendResult.reason })
          .where(eq(outreachCampaignSteps.id, step.id))
        result.failed += 1
        await incrementCampaignMetric(accountId, step.campaignId, 'failed')
        continue
      }

      await markStepSent(step.id, sendResult.providerMessageId)
      await recordSendActivity(accountId, actorUserId, lead.id, step, 'email_sent', lead.email)
      await touchLeadContacted(lead)
      result.sent += 1
      await incrementCampaignMetric(accountId, step.campaignId, 'sent')
      continue
    }

    if (step.channel === 'sms') {
      if (!lead.phone) {
        await db
          .update(outreachCampaignSteps)
          .set({ status: 'skipped', skipReason: 'missing_phone' })
          .where(eq(outreachCampaignSteps.id, step.id))
        result.skipped += 1
        continue
      }

      const sendResult = await sendCampaignSms({
        accountId,
        toPhone: lead.phone,
        body: step.body,
        lead,
      })

      if (!sendResult.ok) {
        await db
          .update(outreachCampaignSteps)
          .set({ status: 'failed', skipReason: sendResult.reason })
          .where(eq(outreachCampaignSteps.id, step.id))
        result.failed += 1
        await incrementCampaignMetric(accountId, step.campaignId, 'failed')
        continue
      }

      await markStepSent(step.id, sendResult.providerMessageId)
      await recordSendActivity(accountId, actorUserId, lead.id, step, 'sms_sent', lead.phone)
      await touchLeadContacted(lead)
      result.sent += 1
      await incrementCampaignMetric(accountId, step.campaignId, 'sent')
      continue
    }

    if (step.channel === 'linkedin') {
      if (!lead.linkedinUrl) {
        await db
          .update(outreachCampaignSteps)
          .set({ status: 'skipped', skipReason: 'missing_linkedin' })
          .where(eq(outreachCampaignSteps.id, step.id))
        result.skipped += 1
        continue
      }

      const personalizedBody = personalizeTemplate(step.body, lead)

      await db
        .update(outreachCampaignSteps)
        .set({
          metadata: {
            manualSend: true,
            readyAt: new Date().toISOString(),
            linkedinUrl: lead.linkedinUrl,
            message: personalizedBody,
          },
        })
        .where(eq(outreachCampaignSteps.id, step.id))

      await db.insert(activities).values({
        accountId,
        leadId: lead.id,
        actorType: 'automation',
        actorId: actorUserId,
        activityType: 'linkedin_step_ready',
        body: `LinkedIn message ready for ${leadDisplayName(lead)}`,
        metadata: {
          campaignId: step.campaignId,
          stepId: step.id,
          linkedinUrl: lead.linkedinUrl,
        },
      })

      await createIntelligenceSignal({
        accountId,
        signalType: 'linkedin_step_ready',
        severity: 'yellow',
        headline: `LinkedIn step ready — ${leadDisplayName(lead)}`,
        recommendation: 'Copy the message and mark sent after connecting on LinkedIn',
        actionLabel: 'Open campaign',
        actionPayload: { campaignId: step.campaignId, stepId: step.id, leadId: lead.id },
        expiresInDays: 7,
      })

      result.manualReady += 1
      continue
    }

    await db
      .update(outreachCampaignSteps)
      .set({ status: 'skipped', skipReason: 'unsupported_channel' })
      .where(eq(outreachCampaignSteps.id, step.id))
    result.skipped += 1
  }

  return result
}

async function markStepSent(stepId: string, providerMessageId?: string) {
  await db
    .update(outreachCampaignSteps)
    .set({
      status: 'sent',
      sentAt: new Date(),
      providerMessageId: providerMessageId ?? null,
      metadata: {},
    })
    .where(eq(outreachCampaignSteps.id, stepId))
}

async function recordSendActivity(
  accountId: string,
  actorUserId: string,
  leadId: string,
  step: { campaignId: string; id: string },
  activityType: string,
  recipient: string,
) {
  await db.insert(activities).values({
    accountId,
    leadId,
    actorType: 'automation',
    actorId: actorUserId,
    activityType,
    body: `Campaign ${activityType.replace('_', ' ')} to ${recipient}`,
    metadata: { campaignId: step.campaignId, stepId: step.id },
  })
}

async function touchLeadContacted(lead: { id: string; relationshipStatus: string | null }) {
  if (lead.relationshipStatus === 'new') {
    await db
      .update(leads)
      .set({ relationshipStatus: 'contacted', updatedAt: new Date() })
      .where(eq(leads.id, lead.id))
  }
}

async function incrementCampaignMetric(
  accountId: string,
  campaignId: string,
  field: 'sent' | 'failed',
) {
  const campaign = await findOutreachCampaignById(accountId, campaignId)
  if (!campaign) return

  const metrics = parseCampaignMetrics(campaign.metrics)
  if (field === 'sent') metrics.sent += 1
  if (field === 'failed') metrics.failed += 1

  await db
    .update(outreachCampaigns)
    .set({ metrics, updatedAt: new Date() })
    .where(eq(outreachCampaigns.id, campaignId))
}

export async function materializeCampaignSteps(
  accountId: string,
  campaignId: string,
  workflow: OutreachCampaignWorkflow,
) {
  const enrollments = await db
    .select()
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, accountId),
        eq(outreachCampaignEnrollments.campaignId, campaignId),
        eq(outreachCampaignEnrollments.status, 'active'),
      ),
    )

  const steps = workflow.steps.filter((step) => {
    if (!step.body.trim()) return false
    if (step.channel === 'email' && !step.subject?.trim()) return false
    return true
  })

  if (steps.length === 0) {
    throw new Error('Campaign workflow has no complete steps')
  }

  const now = Date.now()
  const rows = []

  for (const enrollment of enrollments) {
    for (const step of steps) {
      const sendAt = new Date(now + step.delayDays * 24 * 60 * 60 * 1000)
      rows.push({
        accountId,
        campaignId,
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        stepIndex: step.stepIndex,
        channel: step.channel,
        subject: step.channel === 'email' ? (step.subject ?? 'Quick intro') : null,
        body: step.body,
        sendAt,
        status: 'pending' as const,
      })
    }
  }

  if (rows.length === 0) return 0

  await db.insert(outreachCampaignSteps).values(rows)
  return rows.length
}

export async function markCampaignStepSentCore(
  accountId: string,
  stepId: string,
  actorUserId: string,
): Promise<{ ok: true; campaignId: string } | { ok: false; reason: string }> {
  const [step] = await db
    .select()
    .from(outreachCampaignSteps)
    .where(and(eq(outreachCampaignSteps.id, stepId), eq(outreachCampaignSteps.accountId, accountId)))
    .limit(1)

  if (!step) return { ok: false, reason: 'step_not_found' }
  if (step.status === 'sent') return { ok: false, reason: 'already_sent' }

  const metadata = step.metadata as { manualSend?: boolean } | null
  if (!metadata?.manualSend && step.channel === 'linkedin') {
    return { ok: false, reason: 'step_not_ready' }
  }

  await markStepSent(step.id)

  await db.insert(activities).values({
    accountId,
    leadId: step.leadId,
    actorType: 'user',
    actorId: actorUserId,
    activityType: 'linkedin_sent',
    body: 'LinkedIn campaign step marked as sent',
    metadata: { campaignId: step.campaignId, stepId: step.id },
  })

  await incrementCampaignMetric(accountId, step.campaignId, 'sent')

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, step.leadId))
    .limit(1)

  if (lead) await touchLeadContacted(lead)

  return { ok: true, campaignId: step.campaignId }
}
