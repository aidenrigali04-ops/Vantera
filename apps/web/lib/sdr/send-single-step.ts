import { db } from '@/lib/db/client'
import { consumeSdrCredits, outreachSendCostForChannel, SdrCreditsExhaustedError } from '@/lib/sdr/credits'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { sendSdrEmail, sendSdrSms } from '@/lib/sdr/send-step'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  leads,
  sdrAgentConfigs,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export class SdrSendBlockedError extends Error {
  readonly code: 'SDR_CREDITS_EXHAUSTED' | 'NOT_FOUND' | 'INVALID_STATE'

  constructor(code: SdrSendBlockedError['code'], message: string) {
    super(message)
    this.name = 'SdrSendBlockedError'
    this.code = code
  }
}

export async function sendSdrSequenceStepNow(input: {
  accountId: string
  stepId: string
}): Promise<{ ok: true }> {
  const [step] = await db
    .select()
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.id, input.stepId),
        eq(sdrSequenceSteps.accountId, input.accountId),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .limit(1)

  if (!step) {
    throw new SdrSendBlockedError('NOT_FOUND', 'Outreach step not found')
  }

  if (step.status !== 'scheduled') {
    throw new SdrSendBlockedError('INVALID_STATE', 'This step is not ready to send')
  }

  const [sequence] = await db
    .select()
    .from(sdrSequences)
    .where(eq(sdrSequences.id, step.sequenceId))
    .limit(1)

  if (!sequence || sequence.status !== 'active') {
    throw new SdrSendBlockedError('INVALID_STATE', 'Sequence is not active')
  }

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(eq(sdrAgentConfigs.id, sequence.configId))
    .limit(1)

  if (!config) {
    throw new SdrSendBlockedError('NOT_FOUND', 'SDR agent config not found')
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, step.leadId))
    .limit(1)

  if (!lead) {
    throw new SdrSendBlockedError('NOT_FOUND', 'Lead not found')
  }

  if (lead.tags?.includes('unsubscribed')) {
    throw new SdrSendBlockedError('INVALID_STATE', 'Lead has unsubscribed')
  }

  const now = new Date()
  let providerId: string | null = null
  let sendOk = false
  let failReason = 'unknown'

  if (step.channel === 'email' && lead.email) {
    try {
      await consumeSdrCredits(
        input.accountId,
        'outreach_send',
        step.id,
        outreachSendCostForChannel(step.channel),
        { channel: step.channel, manual: true },
      )
    } catch (error) {
      if (error instanceof SdrCreditsExhaustedError) {
        throw new SdrSendBlockedError('SDR_CREDITS_EXHAUSTED', error.message)
      }
      throw error
    }

    const result = await sendSdrEmail({
      accountId: input.accountId,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      toEmail: lead.email,
      subject: step.subject ?? 'Following up',
      body: step.body,
      signature: config.signature,
      lead,
      stepId: step.id,
    })
    sendOk = result.ok
    if (result.ok) providerId = result.resendId
    else failReason = result.reason
  } else if (step.channel === 'sms' && lead.phone) {
    try {
      await consumeSdrCredits(
        input.accountId,
        'outreach_send',
        step.id,
        outreachSendCostForChannel(step.channel),
        { channel: step.channel, manual: true },
      )
    } catch (error) {
      if (error instanceof SdrCreditsExhaustedError) {
        throw new SdrSendBlockedError('SDR_CREDITS_EXHAUSTED', error.message)
      }
      throw error
    }

    const result = await sendSdrSms({
      accountId: input.accountId,
      toPhone: lead.phone,
      body: step.body,
      lead,
    })
    sendOk = result.ok
    if (result.ok) providerId = result.twilioSid
    else failReason = result.reason
  } else {
    throw new SdrSendBlockedError('INVALID_STATE', 'No valid contact channel for this step')
  }

  if (!sendOk) {
    await db
      .update(sdrSequenceSteps)
      .set({ status: 'failed' })
      .where(eq(sdrSequenceSteps.id, step.id))

    await createIntelligenceSignal({
      accountId: input.accountId,
      signalType: 'sdr_delivery_failed',
      severity: 'red',
      headline: `Delivery failed for ${lead.company}`,
      recommendation: failReason,
      expiresInDays: 2,
    })

    throw new Error(failReason)
  }

  await db
    .update(sdrSequenceSteps)
    .set({
      status: 'sent',
      sentAt: now,
      ...(step.channel === 'email' ? { resendId: providerId } : { twilioSid: providerId }),
    })
    .where(eq(sdrSequenceSteps.id, step.id))

  const nextStep = step.stepNumber + 1
  const isComplete = nextStep > sequence.totalSteps

  const [nextPending] = await db
    .select({ scheduledFor: sdrSequenceSteps.scheduledFor })
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.sequenceId, sequence.id),
        eq(sdrSequenceSteps.status, 'scheduled'),
      ),
    )
    .orderBy(sdrSequenceSteps.stepNumber)
    .limit(1)

  await db
    .update(sdrSequences)
    .set({
      currentStep: step.stepNumber,
      lastStepAt: now,
      nextStepAt: isComplete ? null : (nextPending?.scheduledFor ?? null),
      status: isComplete ? 'completed' : 'active',
    })
    .where(eq(sdrSequences.id, sequence.id))

  await db
    .update(sdrAgentConfigs)
    .set({
      totalContacted: config.totalContacted + 1,
      updatedAt: now,
    })
    .where(eq(sdrAgentConfigs.id, config.id))

  await logSdrActivity({
    accountId: input.accountId,
    configId: config.id,
    leadId: lead.id,
    sequenceId: sequence.id,
    eventType: step.channel === 'sms' ? 'sms_sent' : 'email_sent',
    metadata: { stepNumber: step.stepNumber, company: lead.company, manual: true },
  })

  return { ok: true }
}
