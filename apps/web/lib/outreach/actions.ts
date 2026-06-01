'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { draftLeadMessage } from '@/lib/outreach/draft-lead-message'
import { findLeadsByIds, findOutreachCampaignById } from '@/lib/outreach/queries'
import { enrollLeadsInCampaignCore } from '@/lib/outreach/enroll-leads'
import { recordCampaignInboundReply } from '@/lib/outreach/record-reply'
import { materializeCampaignSteps, processDueCampaignSteps } from '@/lib/outreach/runner'
import {
  CAMPAIGN_GOAL_INTENTS,
  parseCampaignMetrics,
  type OutreachCampaignGoal,
  type OutreachCampaignWorkflow,
} from '@/lib/outreach/types'
import {
  outreachCampaignEnrollments,
  outreachCampaigns,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type CreateCampaignInput = {
  name: string
  goal: OutreachCampaignGoal
}

type SaveCampaignMessageInput = {
  campaignId: string
  subject: string
  body: string
  intent?: string
}

export async function createOutreachCampaign(
  input: CreateCampaignInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminSession()

  const intent = CAMPAIGN_GOAL_INTENTS[input.goal]
  const workflow: OutreachCampaignWorkflow = {
    steps: [
      {
        stepIndex: 0,
        delayDays: 0,
        channel: 'email',
        intent,
        subject: '',
        body: '',
      },
    ],
  }

  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      accountId: session.accountId,
      name: input.name.trim() || 'Untitled campaign',
      goal: input.goal,
      ownerId: session.userId,
      status: 'draft',
      channels: ['email'],
      workflow,
    })
    .returning({ id: outreachCampaigns.id })

  revalidatePath('/admin/outreach/campaigns')
  return { success: true, data: { id: campaign!.id } }
}

export async function saveCampaignMessage(
  input: SaveCampaignMessageInput,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, input.campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }
  if (campaign.status !== 'draft') return { success: false, error: 'Only draft campaigns can be edited' }

  const workflow = campaign.workflow
  const step = workflow.steps[0]
  if (!step) return { success: false, error: 'Campaign has no workflow steps' }

  workflow.steps[0] = {
    ...step,
    subject: input.subject.trim(),
    body: input.body.trim(),
    intent: input.intent?.trim() || step.intent,
  }

  await db
    .update(outreachCampaigns)
    .set({ workflow, updatedAt: new Date() })
    .where(eq(outreachCampaigns.id, input.campaignId))

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${input.campaignId}`)
  return { success: true, data: undefined }
}

export async function enrollLeadsInCampaign(
  campaignId: string,
  leadIds: string[],
): Promise<ActionResult<{ enrolled: number }>> {
  const session = await requireAdminSession()
  const result = await enrollLeadsInCampaignCore(session.accountId, campaignId, leadIds)
  if (!result.success) return { success: false, error: result.error }

  revalidatePath(`/admin/outreach/campaigns/${campaignId}`)
  return { success: true, data: { enrolled: result.enrolled } }
}

export async function launchOutreachCampaign(
  campaignId: string,
): Promise<ActionResult<{ stepsCreated: number; sent: number }>> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }

  const step = campaign.workflow.steps[0]
  if (!step?.body?.trim() || !step.subject?.trim()) {
    return { success: false, error: 'Add a subject and message before launching' }
  }

  const enrollments = await db
    .select({ id: outreachCampaignEnrollments.id })
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.accountId, session.accountId),
        eq(outreachCampaignEnrollments.campaignId, campaignId),
      ),
    )

  if (enrollments.length === 0) {
    return { success: false, error: 'Enroll at least one lead with an email address' }
  }

  let stepsCreated = 0
  try {
    stepsCreated = await materializeCampaignSteps(
      session.accountId,
      campaignId,
      campaign.workflow,
    )
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Could not create campaign steps',
    }
  }

  await db
    .update(outreachCampaigns)
    .set({
      status: 'active',
      launchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaigns.id, campaignId))

  const sendResult = await processDueCampaignSteps(session.accountId, session.userId)

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${campaignId}`)
  revalidatePath('/admin/pipeline')

  return {
    success: true,
    data: { stepsCreated, sent: sendResult.sent },
  }
}

export async function draftCampaignMessage(
  campaignId: string,
  leadId: string,
): Promise<ActionResult<{ subject: string; body: string; rationale: string }>> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }

  const leads = await findLeadsByIds(session.accountId, [leadId])
  const lead = leads[0]
  if (!lead) return { success: false, error: 'Lead not found' }

  const intent = campaign.workflow.steps[0]?.intent ?? CAMPAIGN_GOAL_INTENTS[campaign.goal]

  const draft = await draftLeadMessage({
    accountId: session.accountId,
    userId: session.userId,
    lead,
    intent,
  })

  if (!draft.ok) {
    return { success: false, error: `Could not draft message: ${draft.reason}` }
  }

  return {
    success: true,
    data: draft.output,
  }
}

export async function markCampaignEnrollmentReplied(
  enrollmentId: string,
): Promise<ActionResult> {
  const session = await requireAdminSession()

  const [enrollment] = await db
    .select()
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.id, enrollmentId),
        eq(outreachCampaignEnrollments.accountId, session.accountId),
      ),
    )
    .limit(1)

  if (!enrollment) return { success: false, error: 'Enrollment not found' }

  const leads = await findLeadsByIds(session.accountId, [enrollment.leadId])
  const lead = leads[0]

  const result = await recordCampaignInboundReply({
    accountId: session.accountId,
    enrollmentId: enrollment.id,
    campaignId: enrollment.campaignId,
    leadId: enrollment.leadId,
    fromEmail: lead?.email ?? 'unknown',
    actorUserId: session.userId,
  })

  if (!result.ok) {
    return { success: false, error: result.reason }
  }

  revalidatePath(`/admin/outreach/campaigns/${enrollment.campaignId}`)
  return { success: true, data: undefined }
}

export async function markCampaignEnrollmentMeeting(
  enrollmentId: string,
): Promise<ActionResult> {
  const session = await requireAdminSession()

  const [enrollment] = await db
    .select()
    .from(outreachCampaignEnrollments)
    .where(
      and(
        eq(outreachCampaignEnrollments.id, enrollmentId),
        eq(outreachCampaignEnrollments.accountId, session.accountId),
      ),
    )
    .limit(1)

  if (!enrollment) return { success: false, error: 'Enrollment not found' }

  await db
    .update(outreachCampaignEnrollments)
    .set({
      status: 'completed',
      meetingBookedAt: new Date(),
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaignEnrollments.id, enrollmentId))

  const campaign = await findOutreachCampaignById(session.accountId, enrollment.campaignId)
  if (campaign) {
    const metrics = parseCampaignMetrics(campaign.metrics)
    metrics.meetings += 1
    await db
      .update(outreachCampaigns)
      .set({ metrics, updatedAt: new Date() })
      .where(eq(outreachCampaigns.id, enrollment.campaignId))
  }

  revalidatePath(`/admin/outreach/campaigns/${enrollment.campaignId}`)
  return { success: true, data: undefined }
}

export async function pauseOutreachCampaign(campaignId: string): Promise<ActionResult> {
  const session = await requireAdminSession()

  await db
    .update(outreachCampaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(
      and(
        eq(outreachCampaigns.id, campaignId),
        eq(outreachCampaigns.accountId, session.accountId),
      ),
    )

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${campaignId}`)
  return { success: true, data: undefined }
}
