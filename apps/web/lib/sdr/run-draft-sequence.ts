import type { ApifyLead } from '@/lib/aspire/types'
import { getSystemAutomationId } from '@/lib/automation/system-automation'
import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-policy'
import { runAutomaticPipelineForAccount } from '@/lib/sdr/automatic-pipeline'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { enrichAndProfileLead } from '@/lib/sdr/enrich-and-profile-lead'
import { generateSdrSequenceSteps } from '@/lib/sdr/draft-sequence'
import { requireSDREnabledForAccount } from '@/lib/sdr/guard'
import type { DraftSdrSequencePayload, SdrOutreachWindow } from '@/lib/sdr/types'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import {
  accounts,
  aspireResults,
  automationRuns,
  leadDrafts,
  leads,
  sdrAgentConfigs,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export async function runDraftSdrSequence(payload: DraftSdrSequencePayload): Promise<void> {
  const [account] = await db
    .select({ plan: accounts.plan, name: accounts.name, vertical: accounts.vertical })
    .from(accounts)
    .where(eq(accounts.id, payload.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  await requireSDREnabledForAccount(payload.accountId, plan)

  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(
      and(
        eq(sdrAgentConfigs.id, payload.configId),
        eq(sdrAgentConfigs.accountId, payload.accountId),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )
    .limit(1)

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, payload.leadId), eq(leads.accountId, payload.accountId)))
    .limit(1)

  if (!config || !lead) {
    throw new Error('Missing config or lead for sequence draft')
  }

  let aspireData: ApifyLead | null = null
  let icpSignals: string[] = []

  if (payload.aspireResultId) {
    const [aspireRow] = await db
      .select()
      .from(aspireResults)
      .where(eq(aspireResults.id, payload.aspireResultId))
      .limit(1)

    if (aspireRow) {
      aspireData = aspireRow.rawData as ApifyLead
      icpSignals = (aspireRow.icpSignals as string[]) ?? []
    }
  }

  await enrichAndProfileLead({
    accountId: payload.accountId,
    leadId: payload.leadId,
    aspireData,
    icpScore: lead.score,
    icpSignals,
    source: 'scout',
  })

  const [refreshedLead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, payload.leadId), eq(leads.accountId, payload.accountId)))
    .limit(1)

  const leadForDraft = refreshedLead ?? lead
  const refreshedEnrichment = (leadForDraft.enrichment ?? {}) as Record<string, unknown>
  const profileSignals = Array.isArray(refreshedEnrichment.icpSignals)
    ? (refreshedEnrichment.icpSignals as string[])
    : icpSignals

  const employeeCount = aspireData?.employeeCount ?? null
  const window = (config.outreachWindow as SdrOutreachWindow) ?? {
    startHour: 8,
    endHour: 17,
    tz: 'America/New_York',
  }

  const { steps, scheduledFor } = await generateSdrSequenceSteps({
    accountId: payload.accountId,
    agentName: config.agentName,
    accountDisplayName: account?.name ?? 'Your team',
    vertical: account?.vertical ?? 'agency',
    firstName: leadForDraft.firstName ?? 'there',
    lastName: leadForDraft.lastName ?? '',
    title: leadForDraft.title ?? '',
    company: leadForDraft.company,
    employeeCount,
    icpScore: leadForDraft.score,
    icpSignals: profileSignals,
    icpConfig: config.icpConfig as Parameters<typeof generateSdrSequenceSteps>[0]['icpConfig'],
    outreachDays: config.outreachDays ?? undefined,
    outreachWindow: window,
  })

  await db
    .delete(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.sequenceId, payload.sequenceId),
        eq(sdrSequenceSteps.accountId, payload.accountId),
      ),
    )

  const insertedSteps: Array<{ id: string; stepNumber: number; channel: string }> = []

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    const [row] = await db
      .insert(sdrSequenceSteps)
      .values({
        accountId: payload.accountId,
        sequenceId: payload.sequenceId,
        leadId: payload.leadId,
        stepNumber: step.stepNumber,
        channel: step.channel,
        subject: step.subject,
        body: step.body,
        scheduledFor: scheduledFor[i] ?? new Date(),
        status: 'scheduled',
      })
      .returning({
        id: sdrSequenceSteps.id,
        stepNumber: sdrSequenceSteps.stepNumber,
        channel: sdrSequenceSteps.channel,
      })

    if (row) insertedSteps.push(row)
  }

  await db
    .update(sdrSequences)
    .set({
      status: 'active',
      totalSteps: steps.length,
      nextStepAt: scheduledFor[0] ?? null,
    })
    .where(eq(sdrSequences.id, payload.sequenceId))

  await logSdrActivity({
    accountId: payload.accountId,
    configId: config.id,
    leadId: payload.leadId,
    sequenceId: payload.sequenceId,
    eventType: 'sequence_drafted',
    metadata: { steps: steps.length },
  })

  const automatic = await isAccountAutomaticOutreach(payload.accountId)
  const automationMode = automatic ? 'automatic' : 'review'

  if (!automatic) {
    for (const inserted of insertedSteps) {
      const step = steps.find((s) => s.stepNumber === inserted.stepNumber)
      if (!step) continue

      await createIntelligenceSignal({
        accountId: payload.accountId,
        signalType: 'sdr_step_review',
        severity: 'yellow',
        headline: `Review ${config.agentName}'s ${step.channel} before sending to ${lead.firstName}`,
        actionLabel: 'Review in Message Drafter',
        actionPayload: {
          sequenceId: payload.sequenceId,
          leadId: payload.leadId,
          stepId: inserted.id,
        },
        expiresInDays: 7,
      })

      if (step.channel === 'email' || step.channel === 'sms') {
        await db.insert(leadDrafts).values({
          accountId: payload.accountId,
          leadId: payload.leadId,
          channel: step.channel,
          subject: step.subject,
          body: step.body,
          draftedBy: config.agentName,
          status: 'pending_review',
          metadata: {
            sdrSequenceId: payload.sequenceId,
            sequenceStepId: inserted.id,
            stepNumber: step.stepNumber,
          },
        })
      }
    }
  } else {
    void runAutomaticPipelineForAccount(payload.accountId).catch((err) => {
      console.error('[runDraftSdrSequence] automatic pipeline failed', err)
    })
  }

  const automationId = await getSystemAutomationId(payload.accountId, 'sdr_draft')
  await db.insert(automationRuns).values({
    accountId: payload.accountId,
    automationId,
    triggerEvent: 'draft_sdr_sequence',
    actionType: 'sequence_draft',
    status: 'success',
    resultPayload: {
      sequenceId: payload.sequenceId,
      steps: steps.length,
      automationMode,
    },
  })
}
