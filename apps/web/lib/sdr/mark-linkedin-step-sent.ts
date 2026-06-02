import { db } from '@/lib/db/client'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { activities, leads, sdrAgentConfigs, sdrSequenceSteps, sdrSequences } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export async function markSdrLinkedInStepSent(input: {
  accountId: string
  stepId: string
  actorUserId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [row] = await db
    .select({
      step: sdrSequenceSteps,
      sequence: sdrSequences,
      lead: leads,
    })
    .from(sdrSequenceSteps)
    .innerJoin(sdrSequences, eq(sdrSequenceSteps.sequenceId, sdrSequences.id))
    .innerJoin(leads, eq(sdrSequenceSteps.leadId, leads.id))
    .where(
      and(
        eq(sdrSequenceSteps.id, input.stepId),
        eq(sdrSequenceSteps.accountId, input.accountId),
        eq(sdrSequenceSteps.channel, 'linkedin'),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .limit(1)

  if (!row) return { ok: false, error: 'LinkedIn step not found' }
  if (row.step.status !== 'scheduled') return { ok: false, error: 'Step already processed' }

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(eq(sdrAgentConfigs.id, row.sequence.configId))
    .limit(1)

  await db
    .update(sdrSequenceSteps)
    .set({ status: 'sent', sentAt: new Date() })
    .where(eq(sdrSequenceSteps.id, input.stepId))

  await db.insert(activities).values({
    accountId: input.accountId,
    leadId: row.lead.id,
    actorType: 'user',
    actorId: input.actorUserId,
    activityType: 'linkedin_sent',
    body: 'LinkedIn sequence step marked as sent',
    metadata: { stepId: input.stepId, sequenceId: row.sequence.id },
  })

  if (config) {
    await logSdrActivity({
      accountId: input.accountId,
      configId: config.id,
      leadId: row.lead.id,
      sequenceId: row.sequence.id,
      eventType: 'linkedin_sent',
      metadata: { stepNumber: row.step.stepNumber, manual: true },
    })
  }

  return { ok: true }
}
