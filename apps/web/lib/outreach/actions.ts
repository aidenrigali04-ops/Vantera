'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { isAiMessageDraftingEnabled } from '@/lib/ai/drafting-enabled'
import { draftCampaignStepMessage } from '@/lib/outreach/draft-campaign-step'
import { findLeadsByIds, findOutreachCampaignById } from '@/lib/outreach/queries'
import { enrollLeadsInCampaignCore } from '@/lib/outreach/enroll-leads'
import { recordCampaignInboundReply } from '@/lib/outreach/record-reply'
import { materializeCampaignSteps, markCampaignStepSentCore, processDueCampaignSteps } from '@/lib/outreach/runner'
import {
  CAMPAIGN_GOAL_INTENTS,
  parseCampaignMetrics,
  parseCampaignWorkflow,
  type OutreachCampaignGoal,
  type OutreachCampaignWorkflow,
  type OutreachCampaignWorkflowStep,
} from '@/lib/outreach/types'
import type {
  CampaignChannelFocus,
  CampaignDeliveryMode,
} from '@/lib/outreach/campaign-draft-guidelines'
import { getCampaignChannelFocus, getCampaignDeliveryMode } from '@/lib/outreach/types'
import {
  channelsFromWorkflow,
  defaultWorkflowForGoal,
  linkedinSequenceWorkflowForGoal,
  singleEmailWorkflowForGoal,
  singleLinkedInWorkflowForGoal,
  validateWorkflowForLaunch,
} from '@/lib/outreach/workflow-templates'
import {
  accounts,
  outreachCampaignEnrollments,
  outreachCampaigns,
} from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type CreateCampaignInput = {
  name: string
  goal: OutreachCampaignGoal
  deliveryMode?: CampaignDeliveryMode
  channelFocus?: CampaignChannelFocus
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

  const channelFocus = input.channelFocus ?? 'email'
  const deliveryMode =
    input.deliveryMode ??
    (channelFocus === 'linkedin' ? 'linkedin_sequence' : 'sequence')
  const workflow = defaultWorkflowForGoal(input.goal, deliveryMode, channelFocus)

  const [campaign] = await db
    .insert(outreachCampaigns)
    .values({
      accountId: session.accountId,
      name: input.name.trim() || 'Untitled campaign',
      goal: input.goal,
      ownerId: session.userId,
      status: 'draft',
      channels: channelsFromWorkflow(workflow),
      workflow,
    })
    .returning({ id: outreachCampaigns.id })

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath('/admin/outreach/email')
  revalidatePath('/admin/outreach/linkedin')
  return { success: true, data: { id: campaign!.id } }
}

type SaveCampaignWorkflowInput = {
  campaignId: string
  steps: OutreachCampaignWorkflowStep[]
}

export async function saveCampaignWorkflow(
  input: SaveCampaignWorkflowInput,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, input.campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }
  if (campaign.status !== 'draft') {
    return { success: false, error: 'Only draft campaigns can be edited' }
  }

  const steps = input.steps.map((step, index) => ({
    ...step,
    stepIndex: index,
    delayDays: Math.max(0, Number(step.delayDays) || 0),
    subject: step.subject?.trim() ?? '',
    body: step.body?.trim() ?? '',
  }))

  const parsed = parseCampaignWorkflow(campaign.workflow)
  const workflow: OutreachCampaignWorkflow = {
    steps,
    deliveryMode: parsed.deliveryMode,
    channelFocus: parsed.channelFocus,
  }

  await db
    .update(outreachCampaigns)
    .set({
      workflow,
      channels: channelsFromWorkflow(workflow),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaigns.id, input.campaignId))

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${input.campaignId}`)
  return { success: true, data: undefined }
}

export async function saveCampaignDeliveryMode(
  campaignId: string,
  deliveryMode: CampaignDeliveryMode,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }
  if (campaign.status !== 'draft') {
    return { success: false, error: 'Only draft campaigns can change delivery mode' }
  }

  const currentMode = getCampaignDeliveryMode(campaign.workflow)
  if (currentMode === deliveryMode) {
    return { success: true, data: undefined }
  }

  let workflow: OutreachCampaignWorkflow

  const preserved = campaign.workflow.steps.find((s) => s.body.trim())

  if (deliveryMode === 'single_email') {
    const existingEmail = campaign.workflow.steps.find((s) => s.channel === 'email')
    workflow = singleEmailWorkflowForGoal(campaign.goal)
    const first = workflow.steps[0]
    if (existingEmail && first) {
      workflow.steps[0] = {
        ...first,
        subject: existingEmail.subject ?? '',
        body: existingEmail.body ?? '',
        intent: existingEmail.intent || first.intent,
      }
    }
  } else if (deliveryMode === 'single_linkedin') {
    const existing = campaign.workflow.steps.find((s) => s.channel === 'linkedin')
    workflow = singleLinkedInWorkflowForGoal(campaign.goal)
    const first = workflow.steps[0]
    if (existing && first) {
      workflow.steps[0] = {
        ...first,
        body: existing.body,
        intent: existing.intent || first.intent,
      }
    }
  } else if (deliveryMode === 'linkedin_sequence') {
    workflow = linkedinSequenceWorkflowForGoal(campaign.goal)
    const first = workflow.steps[0]
    if (preserved?.channel === 'linkedin' && first) {
      workflow.steps[0] = {
        ...first,
        body: preserved.body,
        intent: preserved.intent || first.intent,
      }
    }
  } else {
    workflow = defaultWorkflowForGoal(campaign.goal, 'sequence', 'email')
    const first = workflow.steps[0]
    if (preserved && first) {
      workflow.steps[0] = {
        ...first,
        subject: preserved.subject ?? first.subject,
        body: preserved.body,
        intent: preserved.intent || first.intent,
        channel: preserved.channel === 'email' ? 'email' : first.channel,
      }
    }
  }

  await db
    .update(outreachCampaigns)
    .set({
      workflow,
      channels: channelsFromWorkflow(workflow),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaigns.id, campaignId))

  revalidatePath('/admin/outreach/email')
  revalidatePath('/admin/outreach/linkedin')
  revalidatePath(`/admin/outreach/campaigns/${campaignId}`)
  return { success: true, data: undefined }
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
    .set({
      workflow: {
        ...workflow,
        deliveryMode: getCampaignDeliveryMode(campaign.workflow),
        channelFocus: getCampaignChannelFocus(campaign.workflow),
      },
      channels: channelsFromWorkflow(workflow),
      updatedAt: new Date(),
    })
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
): Promise<ActionResult<{ stepsCreated: number; sent: number; manualReady: number }>> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }

  const validationError = validateWorkflowForLaunch(campaign.workflow)
  if (validationError) return { success: false, error: validationError }

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
    return { success: false, error: 'Enroll at least one lead before launching' }
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
  revalidatePath('/admin/crm/pipeline')

  return {
    success: true,
    data: {
      stepsCreated,
      sent: sendResult.sent,
      manualReady: sendResult.manualReady,
    },
  }
}

export async function draftCampaignMessage(
  campaignId: string,
  leadId: string,
  stepIndex = 0,
  options?: { writerNotes?: string },
): Promise<ActionResult<{ subject: string; body: string; rationale: string }>> {
  const session = await requireAdminSession()
  const campaign = await findOutreachCampaignById(session.accountId, campaignId)
  if (!campaign) return { success: false, error: 'Campaign not found' }

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as import('@/lib/feature-flags/flags').Plan
  const draftingEnabled = await isAiMessageDraftingEnabled(session.accountId, plan)
  if (!draftingEnabled) {
    return {
      success: false,
      error: 'AI drafting is not enabled. Add ANTHROPIC_API_KEY or enable ai_message_drafting for your plan.',
    }
  }

  const leads = await findLeadsByIds(session.accountId, [leadId])
  const lead = leads[0]
  if (!lead) return { success: false, error: 'Lead not found' }

  const step = campaign.workflow.steps[stepIndex]
  if (!step) return { success: false, error: 'Invalid sequence step' }

  let intent = step.intent?.trim() || CAMPAIGN_GOAL_INTENTS[campaign.goal]
  const notes = options?.writerNotes?.trim()
  if (notes) {
    intent = `${intent}\n\nAdditional direction from the user: ${notes}`
  }

  const draft = await draftCampaignStepMessage({
    accountId: session.accountId,
    lead,
    channel: step.channel,
    intent,
    goal: campaign.goal,
    stepIndex,
    existingDraft:
      step.body.trim().length > 0
        ? { subject: step.subject, body: step.body }
        : undefined,
  })

  if (!draft.ok) {
    const reasonMessages: Record<string, string> = {
      no_api_key: 'Add ANTHROPIC_API_KEY to your environment to generate AI copy.',
      timeout: 'Anthropic timed out — try again in a moment.',
      parse_error: 'Could not parse the AI response — try again.',
      api_error: 'Anthropic API error — check your key and billing.',
    }
    return {
      success: false,
      error: reasonMessages[draft.reason] ?? `Could not draft message: ${draft.reason}`,
    }
  }

  return {
    success: true,
    data: {
      subject: draft.output.subject ?? '',
      body: draft.output.body,
      rationale: draft.output.rationale,
    },
  }
}

export async function markCampaignStepSent(stepId: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const result = await markCampaignStepSentCore(session.accountId, stepId, session.userId)
  if (!result.ok) {
    const messages: Record<string, string> = {
      step_not_found: 'Step not found',
      already_sent: 'Step already marked as sent',
      step_not_ready: 'Step is not ready for manual send',
    }
    return { success: false, error: messages[result.reason] ?? 'Could not mark step sent' }
  }

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${result.campaignId}`)
  return { success: true, data: undefined }
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

  const [updated] = await db
    .update(outreachCampaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(
      and(
        eq(outreachCampaigns.id, campaignId),
        eq(outreachCampaigns.accountId, session.accountId),
      ),
    )
    .returning({ id: outreachCampaigns.id })

  if (!updated) {
    return { success: false, error: 'Campaign not found' }
  }

  revalidatePath('/admin/outreach/campaigns')
  revalidatePath(`/admin/outreach/campaigns/${campaignId}`)
  return { success: true, data: undefined }
}
