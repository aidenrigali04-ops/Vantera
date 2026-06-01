import { callModel, parseJsonResponse } from '@/lib/ai/client'
import { db } from '@/lib/db/client'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { reinforceSdrSegmentMemory } from '@/lib/sdr/memory'
import type { SdrReplyType } from '@/lib/sdr/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  activities,
  leadDrafts,
  leads,
  sdrAgentConfigs,
  sdrSequenceSteps,
  sdrSequences,
  users,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

async function resolveAutomationActorId(accountId: string): Promise<string> {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.accountId, accountId), eq(users.role, 'owner'), eq(users.isActive, true)))
    .limit(1)
  return owner?.id ?? accountId
}

export async function classifySdrReply(
  accountId: string,
  body: string,
): Promise<{
  type: SdrReplyType
  confidence: number
  reason: string
}> {
  const result = await callModel({
    accountId,
    toolName: 'classify-sdr-reply',
    system: `Classify this sales reply. Return JSON only: { "type": "interested"|"objection"|"wrong_person"|"unsubscribe", "confidence": 0-100, "reason": "..." }`,
    user: body.slice(0, 2000),
    maxTokens: 200,
    timeoutMs: 30_000,
  })

  if (!result.ok) {
    return { type: 'objection', confidence: 50, reason: 'classification_failed' }
  }

  const parsed = parseJsonResponse<{
    type: SdrReplyType
    confidence: number
    reason: string
  }>(result.text, (raw) => {
    if (!raw || typeof raw !== 'object') return null
    const r = raw as Record<string, unknown>
    const type = r.type
    if (
      type !== 'interested' &&
      type !== 'objection' &&
      type !== 'wrong_person' &&
      type !== 'unsubscribe'
    ) {
      return null
    }
    return {
      type,
      confidence: typeof r.confidence === 'number' ? r.confidence : 70,
      reason: typeof r.reason === 'string' ? r.reason : '',
    }
  })

  return parsed ?? { type: 'objection', confidence: 50, reason: 'parse_failed' }
}

export async function handleSdrReply(input: {
  stepId?: string | null
  resendId?: string | null
  twilioSid?: string | null
  bodyPreview?: string
  fromEmail?: string
}): Promise<{ handled: boolean }> {
  let step = null

  if (input.stepId) {
    const [row] = await db
      .select()
      .from(sdrSequenceSteps)
      .where(and(eq(sdrSequenceSteps.id, input.stepId), isNull(sdrSequenceSteps.deletedAt)))
      .limit(1)
    step = row ?? null
  }

  if (!step && input.resendId) {
    const [row] = await db
      .select()
      .from(sdrSequenceSteps)
      .where(eq(sdrSequenceSteps.resendId, input.resendId))
      .limit(1)
    step = row ?? null
  }

  if (!step && input.twilioSid) {
    const [row] = await db
      .select()
      .from(sdrSequenceSteps)
      .where(eq(sdrSequenceSteps.twilioSid, input.twilioSid))
      .limit(1)
    step = row ?? null
  }

  if (!step) return { handled: false }

  const [sequence] = await db
    .select()
    .from(sdrSequences)
    .where(eq(sdrSequences.id, step.sequenceId))
    .limit(1)

  if (!sequence || sequence.status !== 'active') {
    return { handled: true }
  }

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(eq(sdrAgentConfigs.id, sequence.configId))
    .limit(1)

  const [lead] = await db.select().from(leads).where(eq(leads.id, step.leadId)).limit(1)
  if (!config || !lead) return { handled: true }

  const classification = await classifySdrReply(config.accountId, input.bodyPreview ?? '')
  const now = new Date()

  await db
    .update(sdrSequenceSteps)
    .set({ status: 'cancelled' })
    .where(
      and(eq(sdrSequenceSteps.sequenceId, sequence.id), eq(sdrSequenceSteps.status, 'scheduled')),
    )

  await db
    .update(sdrSequenceSteps)
    .set({ repliedAt: now })
    .where(eq(sdrSequenceSteps.id, step.id))

  const sequenceStatus =
    classification.type === 'interested'
      ? 'replied'
      : classification.type === 'unsubscribe'
        ? 'unsubscribed'
        : 'replied'

  await db
    .update(sdrSequences)
    .set({
      status: sequenceStatus,
      repliedAt: now,
      replyType: classification.type,
      ...(classification.type === 'interested' ? { bookedAt: now } : {}),
    })
    .where(eq(sdrSequences.id, sequence.id))

  await db
    .update(sdrAgentConfigs)
    .set({
      totalReplied: config.totalReplied + 1,
      ...(classification.type === 'interested'
        ? { totalBooked: config.totalBooked + 1 }
        : {}),
      updatedAt: now,
    })
    .where(eq(sdrAgentConfigs.id, config.id))

  await logSdrActivity({
    accountId: config.accountId,
    configId: config.id,
    leadId: lead.id,
    sequenceId: sequence.id,
    eventType: 'reply_detected',
    metadata: { replyType: classification.type, stepNumber: step.stepNumber },
  })

  if (classification.type === 'interested') {
    await db
      .update(leads)
      .set({
        relationshipStatus: 'qualified',
        updatedAt: now,
      })
      .where(eq(leads.id, lead.id))

    const actorId = await resolveAutomationActorId(config.accountId)

    await db.insert(activities).values({
      accountId: config.accountId,
      leadId: lead.id,
      actorType: 'automation',
      actorId,
      activityType: 'sdr_reply_interested',
      body: `${lead.firstName ?? 'Prospect'} replied with interest`,
      metadata: { sequenceId: sequence.id, replyType: classification.type },
      visibleToClient: false,
    })

    await createIntelligenceSignal({
      accountId: config.accountId,
      signalType: 'sdr_reply_interested',
      severity: 'red',
      headline: `${lead.firstName ?? 'Prospect'} at ${lead.company} replied — INTERESTED`,
      recommendation: 'Reply within 5 minutes — buyer intent is highest now',
      actionLabel: 'Reply now',
      actionPayload: { leadId: lead.id, sequenceId: sequence.id },
      expiresInDays: 1,
    })

    await reinforceSdrSegmentMemory({
      accountId: config.accountId,
      vertical: (lead.enrichment as { industry?: string })?.industry ?? 'agency',
      employeeCount: null,
      stepNumber: step.stepNumber,
      channel: step.channel,
      openingHook: step.body.slice(0, 40),
      outcome: 'interested',
    })
  } else if (classification.type === 'objection') {
    await createIntelligenceSignal({
      accountId: config.accountId,
      signalType: 'sdr_reply_objection',
      severity: 'yellow',
      headline: `${lead.firstName ?? 'Prospect'} objected — review and respond`,
      actionLabel: 'View lead',
      actionPayload: { leadId: lead.id },
      expiresInDays: 3,
    })

    await db.insert(leadDrafts).values({
      accountId: config.accountId,
      leadId: lead.id,
      channel: 'email',
      subject: `Re: ${step.subject ?? 'your note'}`,
      body: input.bodyPreview?.slice(0, 500) ?? '',
      draftedBy: config.agentName,
      status: 'pending_review',
      metadata: { sdrReplyObjection: true, sequenceId: sequence.id },
    })
  } else if (classification.type === 'unsubscribe') {
    await db
      .update(leads)
      .set({
        tags: [...(lead.tags ?? []), 'unsubscribed'],
        updatedAt: now,
      })
      .where(eq(leads.id, lead.id))
  }

  return { handled: true }
}
