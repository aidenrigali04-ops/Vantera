import { db } from '@/lib/db/client'
import { findDueCampaignSteps, findOutreachCampaignById } from '@/lib/outreach/queries'
import { sendCampaignEmail } from '@/lib/outreach/send-email'
import { parseCampaignMetrics, type OutreachCampaignWorkflow } from '@/lib/outreach/types'
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
}

export async function processDueCampaignSteps(
  accountId: string,
  actorUserId: string,
): Promise<ProcessDueStepsResult> {
  const dueSteps = await findDueCampaignSteps(accountId, 50)
  const result: ProcessDueStepsResult = { processed: 0, sent: 0, failed: 0, skipped: 0 }

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

    if (!lead?.email) {
      await db
        .update(outreachCampaignSteps)
        .set({ status: 'skipped', skipReason: 'missing_email' })
        .where(eq(outreachCampaignSteps.id, step.id))
      result.skipped += 1
      await incrementCampaignMetric(accountId, step.campaignId, 'failed')
      continue
    }

    if (step.channel !== 'email') {
      await db
        .update(outreachCampaignSteps)
        .set({ status: 'skipped', skipReason: 'channel_not_supported_in_phase_1' })
        .where(eq(outreachCampaignSteps.id, step.id))
      result.skipped += 1
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

    await db
      .update(outreachCampaignSteps)
      .set({
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: sendResult.providerMessageId,
      })
      .where(eq(outreachCampaignSteps.id, step.id))

    if (lead.relationshipStatus === 'new') {
      await db
        .update(leads)
        .set({ relationshipStatus: 'contacted', updatedAt: new Date() })
        .where(eq(leads.id, lead.id))
    }

    await db.insert(activities).values({
      accountId,
      leadId: lead.id,
      actorType: 'automation',
      actorId: actorUserId,
      activityType: 'email_sent',
      body: `Campaign email sent to ${lead.email}`,
      metadata: { campaignId: step.campaignId, stepId: step.id },
    })

    result.sent += 1
    await incrementCampaignMetric(accountId, step.campaignId, 'sent')
  }

  return result
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

  const steps = workflow.steps.filter((step) => step.channel === 'email' && step.body.trim())
  if (steps.length === 0) {
    throw new Error('Campaign workflow has no email steps')
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
        channel: 'email' as const,
        subject: step.subject ?? 'Quick intro',
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
