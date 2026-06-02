import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { consumeSdrCredits, outreachSendCostForChannel, SDR_TRIAL_DAYS, SdrCreditsExhaustedError } from '@/lib/sdr/credits'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { requireSDREnabledForAccount } from '@/lib/sdr/guard'
import { findDueSdrSteps } from '@/lib/sdr/queries'
import { isOutreachDay, isWithinOutreachWindow } from '@/lib/sdr/schedule'
import { sendSdrEmail, sendSdrSms } from '@/lib/sdr/send-step'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  automationRuns,
  leads,
  sdrAgentConfigs,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export async function runSdrAgentSend(): Promise<{ sent: number; failed: number }> {
  const configs = await db
    .select({
      config: sdrAgentConfigs,
      plan: accounts.plan,
    })
    .from(sdrAgentConfigs)
    .innerJoin(accounts, eq(sdrAgentConfigs.accountId, accounts.id))
    .where(
      and(
        eq(sdrAgentConfigs.isActive, true),
        eq(sdrAgentConfigs.isPaused, false),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )

  let sent = 0
  let failed = 0
  const now = new Date()

  for (const { config, plan } of configs) {
    try {
      await requireSDREnabledForAccount(config.accountId, plan as Plan)
    } catch {
      continue
    }

    const autonomous = await evaluateFlag({
      accountId: config.accountId,
      plan: plan as Plan,
      flagName: 'autonomous_ai_messaging',
    })
    if (!autonomous) continue

    const window = (config.outreachWindow as SdrOutreachWindow) ?? {
      startHour: 8,
      endHour: 17,
      tz: 'America/New_York',
    }

    if (!isWithinOutreachWindow(now, window)) continue
    if (!isOutreachDay(now, config.outreachDays ?? [], window.tz)) continue

    const dueSteps = await findDueSdrSteps(config.accountId, 50)

    for (const step of dueSteps) {
      const [sequence] = await db
        .select()
        .from(sdrSequences)
        .where(eq(sdrSequences.id, step.sequenceId))
        .limit(1)

      if (!sequence || sequence.status !== 'active') continue

      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, step.leadId))
        .limit(1)

      if (!lead) continue
      if (lead.tags?.includes('unsubscribed')) continue

      let providerId: string | null = null
      let sendOk = false
      let failReason = 'unknown'

      if (step.channel === 'email' && lead.email) {
        try {
          await consumeSdrCredits(
            config.accountId,
            'outreach_send',
            step.id,
            outreachSendCostForChannel(step.channel),
            { channel: step.channel },
          )
        } catch (error) {
          if (error instanceof SdrCreditsExhaustedError) {
            await createIntelligenceSignal({
              accountId: config.accountId,
              signalType: 'sdr_credits_exhausted',
              severity: 'yellow',
              headline: 'SDR outreach credits exhausted',
              recommendation: `Upgrade or start a ${SDR_TRIAL_DAYS}-day trial to resume automated sends.`,
              actionLabel: 'View plans',
              actionPayload: { href: '/admin/outreach/agents' },
              expiresInDays: 7,
            })
            break
          }
          throw error
        }

        const result = await sendSdrEmail({
          accountId: config.accountId,
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
            config.accountId,
            'outreach_send',
            step.id,
            outreachSendCostForChannel(step.channel),
            { channel: step.channel },
          )
        } catch (error) {
          if (error instanceof SdrCreditsExhaustedError) {
            await createIntelligenceSignal({
              accountId: config.accountId,
              signalType: 'sdr_credits_exhausted',
              severity: 'yellow',
              headline: 'SDR outreach credits exhausted',
              recommendation: `Upgrade or start a ${SDR_TRIAL_DAYS}-day trial to resume automated sends.`,
              actionLabel: 'View plans',
              actionPayload: { href: '/admin/outreach/agents' },
              expiresInDays: 7,
            })
            break
          }
          throw error
        }

        const result = await sendSdrSms({
          accountId: config.accountId,
          toPhone: lead.phone,
          body: step.body,
          lead,
        })
        sendOk = result.ok
        if (result.ok) providerId = result.twilioSid
        else failReason = result.reason
      } else {
        await db
          .update(sdrSequenceSteps)
          .set({ status: 'skipped' })
          .where(eq(sdrSequenceSteps.id, step.id))
        continue
      }

      if (!sendOk) {
        failed += 1
        await db
          .update(sdrSequenceSteps)
          .set({ status: 'failed' })
          .where(eq(sdrSequenceSteps.id, step.id))

        if (step.stepNumber === 1) {
          await db
            .update(sdrSequences)
            .set({ status: 'paused' })
            .where(eq(sdrSequences.id, sequence.id))
        }

        await createIntelligenceSignal({
          accountId: config.accountId,
          signalType: 'sdr_delivery_failed',
          severity: 'red',
          headline: `Delivery failed for ${lead.company}`,
          recommendation: failReason,
          expiresInDays: 2,
        })
        continue
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
        accountId: config.accountId,
        configId: config.id,
        leadId: lead.id,
        sequenceId: sequence.id,
        eventType: step.channel === 'sms' ? 'sms_sent' : 'email_sent',
        metadata: { stepNumber: step.stepNumber, company: lead.company },
      })

      await createIntelligenceSignal({
        accountId: config.accountId,
        signalType: 'sdr_step_sent',
        severity: 'green',
        headline: `${config.agentName} sent step ${step.stepNumber} to ${lead.firstName ?? 'prospect'} at ${lead.company}`,
        expiresInDays: 1,
      })

      sent += 1
    }

    if (dueSteps.length > 0) {
      const automationId = await getSystemAutomationId(config.accountId, 'sdr_send')
      await db.insert(automationRuns).values({
        accountId: config.accountId,
        automationId,
        triggerEvent: 'sdr_agent_send',
        actionType: 'sequence_send',
        status: 'success',
        resultPayload: { sent, failed },
      })
    }
  }

  return { sent, failed }
}
