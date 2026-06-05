import { db } from '@/lib/db/client'
import { enrollLeadsInCampaignCore } from '@/lib/outreach/enroll-leads'
import {
  materializeCampaignStepsFromSdrSequences,
  processDueCampaignSteps,
} from '@/lib/outreach/runner'
import {
  isAutoScoutCampaignWorkflow,
  parseCampaignMetrics,
  parseCampaignWorkflow,
  type OutreachCampaignWorkflow,
} from '@/lib/outreach/types'
import { defaultWorkflowForGoal } from '@/lib/outreach/workflow-templates'
import { logOutreachAgentActivity } from '@/lib/outreach-agent/activity-log'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import {
  outreachCampaignSteps,
  outreachCampaigns,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'

export type ScoutRunEnrollment = {
  leadId: string
  sequenceId: string
}

function formatRunCampaignName(runId: string): string {
  const short = runId.slice(0, 8)
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date())
  return `Scout run · ${date} (${short})`
}

async function findCampaignForScoutRun(
  accountId: string,
  runId: string,
): Promise<{ id: string; workflow: OutreachCampaignWorkflow } | null> {
  const rows = await db
    .select({ id: outreachCampaigns.id, workflow: outreachCampaigns.workflow })
    .from(outreachCampaigns)
    .where(
      and(
        eq(outreachCampaigns.accountId, accountId),
        isNull(outreachCampaigns.deletedAt),
      ),
    )

  for (const row of rows) {
    const workflow = parseCampaignWorkflow(row.workflow)
    if (
      isAutoScoutCampaignWorkflow(workflow) &&
      workflow.automation?.aspireSearchRunId === runId
    ) {
      return { id: row.id, workflow }
    }
  }

  return null
}

async function loadReadySequences(
  accountId: string,
  sequenceIds: string[],
): Promise<Array<{ sequenceId: string; leadId: string }>> {
  if (sequenceIds.length === 0) return []

  const rows = await db
    .select({
      sequenceId: sdrSequences.id,
      leadId: sdrSequences.leadId,
      status: sdrSequences.status,
    })
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.accountId, accountId),
        inArray(sdrSequences.id, sequenceIds),
        eq(sdrSequences.status, 'active'),
        isNull(sdrSequences.deletedAt),
      ),
    )

  const ready: Array<{ sequenceId: string; leadId: string }> = []

  for (const row of rows) {
    const [step] = await db
      .select({ id: sdrSequenceSteps.id })
      .from(sdrSequenceSteps)
      .where(
        and(
          eq(sdrSequenceSteps.sequenceId, row.sequenceId),
          eq(sdrSequenceSteps.accountId, accountId),
        ),
      )
      .limit(1)

    if (step) {
      ready.push({ sequenceId: row.sequenceId, leadId: row.leadId })
    }
  }

  return ready
}

/**
 * After a Prospect Scout run: create (or reuse) a campaign for this run's leads,
 * copy personalized SDR sequence steps into campaign sends, launch, and pause SDR sequences.
 */
export async function launchAutomaticScoutRunCampaign(input: {
  accountId: string
  configId: string
  runId: string
  enrollments: ScoutRunEnrollment[]
}): Promise<{
  campaignId: string | null
  leads: number
  stepsCreated: number
  sent: number
}> {
  const empty = { campaignId: null, leads: 0, stepsCreated: 0, sent: 0 }

  if (!(await isAccountAutomaticOutreach(input.accountId))) {
    return empty
  }

  const ready = await loadReadySequences(
    input.accountId,
    input.enrollments.map((e) => e.sequenceId),
  )
  if (ready.length === 0) return empty

  const ownerId = await resolveAccountOwnerId(input.accountId)
  if (!ownerId) {
    console.error('[automatic-scout-campaign] no owner for account', input.accountId)
    return empty
  }

  let campaignId: string
  const existing = await findCampaignForScoutRun(input.accountId, input.runId)

  if (existing) {
    campaignId = existing.id
    const [hasSteps] = await db
      .select({ id: outreachCampaignSteps.id })
      .from(outreachCampaignSteps)
      .where(eq(outreachCampaignSteps.campaignId, campaignId))
      .limit(1)
    if (hasSteps) {
      const sendResult = await processDueCampaignSteps(input.accountId, ownerId, {
        campaignIds: [campaignId],
      })
      return {
        campaignId,
        leads: ready.length,
        stepsCreated: 0,
        sent: sendResult.sent,
      }
    }
  } else {
    const template = defaultWorkflowForGoal('book_meeting', 'sequence', 'email')
    const workflow: OutreachCampaignWorkflow = {
      ...template,
      steps: [
        {
          stepIndex: 0,
          delayDays: 0,
          channel: 'email',
          intent: 'Auto-personalized per lead (Prospect Scout + Message Drafter)',
          subject: 'Personalized outreach',
          body: 'Each enrolled lead receives unique copy from ICP and persona analysis.',
        },
      ],
      automation: {
        source: 'prospect_scout',
        aspireSearchRunId: input.runId,
        autoGenerated: true,
        sequenceCount: ready.length,
      },
    }

    const [created] = await db
      .insert(outreachCampaigns)
      .values({
        accountId: input.accountId,
        name: formatRunCampaignName(input.runId),
        goal: 'book_meeting',
        ownerId,
        status: 'draft',
        channels: ['email', 'sms'],
        workflow,
        metrics: {
          enrolled: 0,
          sent: 0,
          failed: 0,
          replied: 0,
          meetings: 0,
        },
      })
      .returning({ id: outreachCampaigns.id })

    campaignId = created!.id
  }

  const leadIds = [...new Set(ready.map((r) => r.leadId))]
  await enrollLeadsInCampaignCore(input.accountId, campaignId, leadIds)

  const stepsCreated = await materializeCampaignStepsFromSdrSequences({
    accountId: input.accountId,
    campaignId,
    sequenceIds: ready.map((r) => r.sequenceId),
    immediateFirstStep: true,
  })

  if (stepsCreated === 0) {
    return { campaignId, leads: leadIds.length, stepsCreated: 0, sent: 0 }
  }

  await db
    .update(outreachCampaigns)
    .set({
      status: 'active',
      launchedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaigns.id, campaignId))

  await db
    .update(sdrSequences)
    .set({ status: 'paused' })
    .where(
      and(
        eq(sdrSequences.accountId, input.accountId),
        inArray(
          sdrSequences.id,
          ready.map((r) => r.sequenceId),
        ),
      ),
    )

  const sendResult = await processDueCampaignSteps(input.accountId, ownerId, {
    campaignIds: [campaignId],
  })

  await logOutreachAgentActivity(input.accountId, {
    eventType: 'auto_campaign_launched',
    metadata: {
      automaticCampaignId: campaignId,
      runId: input.runId,
      leads: leadIds.length,
      stepsCreated,
      sent: sendResult.sent,
      source: 'automatic_scout_campaign',
    },
  })

  const campaign = await db
    .select({ metrics: outreachCampaigns.metrics })
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, campaignId))
    .limit(1)

  const metrics = parseCampaignMetrics(campaign[0]?.metrics)
  metrics.enrolled = Math.max(metrics.enrolled, leadIds.length)
  metrics.sent += sendResult.sent
  metrics.failed += sendResult.failed

  await db
    .update(outreachCampaigns)
    .set({ metrics, updatedAt: new Date() })
    .where(eq(outreachCampaigns.id, campaignId))

  return {
    campaignId,
    leads: leadIds.length,
    stepsCreated,
    sent: sendResult.sent,
  }
}

export async function findActiveAutoScoutCampaignIds(accountId: string): Promise<string[]> {
  const rows = await db
    .select({ id: outreachCampaigns.id, workflow: outreachCampaigns.workflow, status: outreachCampaigns.status })
    .from(outreachCampaigns)
    .where(
      and(
        eq(outreachCampaigns.accountId, accountId),
        eq(outreachCampaigns.status, 'active'),
        isNull(outreachCampaigns.deletedAt),
      ),
    )

  return rows
    .filter((row) => isAutoScoutCampaignWorkflow(parseCampaignWorkflow(row.workflow)))
    .map((row) => row.id)
}
