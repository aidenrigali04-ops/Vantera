import { db } from '@/lib/db/client'
import { findDueCampaignSteps, findLeadsByIds, findOutreachCampaignById } from '@/lib/outreach/queries'
import { sendCampaignEmail } from '@/lib/outreach/send-email'
import { sendCampaignSms } from '@/lib/outreach/send-sms'
import {
  isAutoScoutCampaignWorkflow,
  parseCampaignMetrics,
  parseCampaignWorkflow,
  resolveOutboundCopy,
  type OutreachCampaignWorkflow,
} from '@/lib/outreach/types'
import { logOutreachAgentActivity } from '@/lib/outreach-agent/activity-log'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  activities,
  leads,
  outreachCampaignEnrollments,
  outreachCampaigns,
  outreachCampaignSteps,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, asc, eq } from 'drizzle-orm'

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

async function logAutoScoutCampaignSend(input: {
  accountId: string
  leadId: string
  campaignId: string
  stepIndex: number
  channel: 'email' | 'sms'
  company: string | null
}) {
  await logOutreachAgentActivity(input.accountId, {
    leadId: input.leadId,
    eventType: input.channel === 'sms' ? 'sms_sent' : 'email_sent',
    metadata: {
      stepNumber: input.stepIndex + 1,
      company: input.company,
      campaignId: input.campaignId,
      source: 'auto_scout_campaign',
    },
  })
}

async function maybeLogAutoScoutCampaignSend(
  input: {
    accountId: string
    lead: { id: string; company: string | null }
    step: { campaignId: string; stepIndex: number }
    channel: 'email' | 'sms'
  },
  autoScoutCampaignIds: Set<string>,
) {
  if (!autoScoutCampaignIds.has(input.step.campaignId)) {
    const campaign = await findOutreachCampaignById(input.accountId, input.step.campaignId)
    if (!campaign || !isAutoScoutCampaignWorkflow(parseCampaignWorkflow(campaign.workflow))) {
      return
    }
    autoScoutCampaignIds.add(input.step.campaignId)
  }
  await logAutoScoutCampaignSend({
    accountId: input.accountId,
    leadId: input.lead.id,
    campaignId: input.step.campaignId,
    stepIndex: input.step.stepIndex,
    channel: input.channel,
    company: input.lead.company,
  })
}

export async function processDueCampaignSteps(
  accountId: string,
  actorUserId: string,
  options?: { campaignIds?: string[]; excludeCampaignIds?: string[] },
): Promise<ProcessDueStepsResult> {
  const dueSteps = await findDueCampaignSteps(accountId, 50, {
    campaignIds: options?.campaignIds,
    excludeCampaignIds: options?.excludeCampaignIds,
  })
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
  const autoScoutCampaignIds = new Set<string>()

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
      await maybeLogAutoScoutCampaignSend(
        {
          accountId,
          lead,
          step,
          channel: 'email',
        },
        autoScoutCampaignIds,
      )
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
      await maybeLogAutoScoutCampaignSend(
        {
          accountId,
          lead,
          step,
          channel: 'sms',
        },
        autoScoutCampaignIds,
      )
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

      const personalizedBody = resolveOutboundCopy(step.body, lead)

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

  const leadRows = await findLeadsByIds(
    accountId,
    enrollments.map((enrollment) => enrollment.leadId),
  )
  const leadById = new Map(leadRows.map((lead) => [lead.id, lead]))

  const now = Date.now()
  const rows = []

  for (const enrollment of enrollments) {
    const lead = leadById.get(enrollment.leadId)
    if (!lead) continue

    for (const step of steps) {
      const sendAt = new Date(now + step.delayDays * 24 * 60 * 60 * 1000)
      const subjectTemplate = step.channel === 'email' ? (step.subject ?? 'Quick intro') : null
      rows.push({
        accountId,
        campaignId,
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        stepIndex: step.stepIndex,
        channel: step.channel,
        subject:
          step.channel === 'email' && subjectTemplate
            ? resolveOutboundCopy(subjectTemplate, lead)
            : null,
        body: resolveOutboundCopy(step.body, lead),
        sendAt,
        status: 'pending' as const,
      })
    }
  }

  if (rows.length === 0) return 0

  await db.insert(outreachCampaignSteps).values(rows)
  return rows.length
}

/** Copy finalized SDR sequence steps (personalized per lead) into a scout auto-campaign. */
export async function materializeCampaignStepsFromSdrSequences(input: {
  accountId: string
  campaignId: string
  sequenceIds: string[]
}): Promise<number> {
  if (input.sequenceIds.length === 0) return 0

  const enrollments = await db
    .select()
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, input.accountId),
        eq(outreachCampaignEnrollments.campaignId, input.campaignId),
        eq(outreachCampaignEnrollments.status, 'active'),
      ),
    )

  const enrollmentByLead = new Map(enrollments.map((row) => [row.leadId, row.id]))

  const rows: Array<{
    accountId: string
    campaignId: string
    enrollmentId: string
    leadId: string
    stepIndex: number
    channel: 'email' | 'sms' | 'linkedin'
    subject: string | null
    body: string
    sendAt: Date
    status: 'pending'
  }> = []

  for (const sequenceId of input.sequenceIds) {
    const [sequence] = await db
      .select({ leadId: sdrSequences.leadId })
      .from(sdrSequences)
      .where(
        and(
          eq(sdrSequences.id, sequenceId),
          eq(sdrSequences.accountId, input.accountId),
        ),
      )
      .limit(1)

    if (!sequence) continue

    const enrollmentId = enrollmentByLead.get(sequence.leadId)
    if (!enrollmentId) continue

    const steps = await db
      .select()
      .from(sdrSequenceSteps)
      .where(
        and(
          eq(sdrSequenceSteps.sequenceId, sequenceId),
          eq(sdrSequenceSteps.accountId, input.accountId),
        ),
      )
      .orderBy(asc(sdrSequenceSteps.stepNumber))

    for (const step of steps) {
      if (!step.body?.trim()) continue
      if (step.channel === 'email' && !step.subject?.trim()) continue
      if (step.channel !== 'email' && step.channel !== 'sms' && step.channel !== 'linkedin') {
        continue
      }

      rows.push({
        accountId: input.accountId,
        campaignId: input.campaignId,
        enrollmentId,
        leadId: sequence.leadId,
        stepIndex: Math.max(0, step.stepNumber - 1),
        channel: step.channel as 'email' | 'sms' | 'linkedin',
        subject: step.channel === 'email' ? step.subject : null,
        body: step.body,
        sendAt: step.scheduledFor ?? new Date(),
        status: 'pending',
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
