import { db } from '@/lib/db/client'
import {
  launchAutomaticScoutRunCampaign,
  type ScoutRunEnrollment,
} from '@/lib/outreach/automatic-scout-campaign'
import { flushAutomaticOutreachPipelines } from '@/lib/sdr/outreach-automation-policy'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { runDraftSdrSequence } from '@/lib/sdr/run-draft-sequence'
import type { DraftSdrSequencePayload } from '@/lib/sdr/types'
import { sdrAgentConfigs, sdrSequences } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export type AutomaticPipelineResult = {
  drafted: number
  draftFailed: number
  sdrSent: number
  sdrFailed: number
  campaignSent: number
  campaignLaunched: number
  campaignStepsCreated: number
  skipped: boolean
}

/** Draft sequences still in `drafting` (profiler never finished). */
async function draftPendingSequences(accountId: string): Promise<{
  drafted: number
  failed: number
}> {
  const pending = await db
    .select({
      sequenceId: sdrSequences.id,
      configId: sdrSequences.configId,
      leadId: sdrSequences.leadId,
      aspireResultId: sdrSequences.aspireResultId,
    })
    .from(sdrSequences)
    .where(
      and(eq(sdrSequences.accountId, accountId), eq(sdrSequences.status, 'drafting')),
    )
    .limit(50)

  let drafted = 0
  let failed = 0

  for (const row of pending) {
    if (!row.aspireResultId) {
      failed += 1
      continue
    }

    const payload: DraftSdrSequencePayload = {
      accountId,
      configId: row.configId,
      sequenceId: row.sequenceId,
      leadId: row.leadId,
      aspireResultId: row.aspireResultId,
    }

    try {
      await runDraftSdrSequence(payload)
      drafted += 1
    } catch (error) {
      failed += 1
      console.error('[automatic-pipeline] draft pending sequence failed', row.sequenceId, error)
    }
  }

  return { drafted, failed }
}

/**
 * When outreach mode is Automatic: finish drafting queued sequences, then send due
 * SDR steps and linked Outreach Agent campaign steps.
 */
export async function runAutomaticPipelineForAccount(
  accountId: string,
): Promise<AutomaticPipelineResult> {
  const empty: AutomaticPipelineResult = {
    drafted: 0,
    draftFailed: 0,
    sdrSent: 0,
    sdrFailed: 0,
    campaignSent: 0,
    campaignLaunched: 0,
    campaignStepsCreated: 0,
    skipped: true,
  }

  if (!(await isAccountAutomaticOutreach(accountId))) {
    return empty
  }

  const draftSummary = await draftPendingSequences(accountId)
  const sendSummary = await flushAutomaticOutreachPipelines(accountId)

  return {
    drafted: draftSummary.drafted,
    draftFailed: draftSummary.failed,
    sdrSent: sendSummary.sdrSent,
    sdrFailed: sendSummary.sdrFailed,
    campaignSent: sendSummary.campaignSent,
    campaignLaunched: 0,
    campaignStepsCreated: 0,
    skipped: false,
  }
}

/**
 * After Prospect Scout enrolls leads: finish any drafting, launch the per-run auto
 * campaign with personalized SDR copy, then send due email/SMS steps immediately.
 */
export async function runAutomaticOutreachAfterScout(
  accountId: string,
  scout?: {
    configId: string
    runId: string
    enrollments: ScoutRunEnrollment[]
  },
): Promise<AutomaticPipelineResult> {
  const base = await runAutomaticPipelineForAccount(accountId)

  if (base.skipped || !scout?.enrollments.length) {
    return base
  }

  let campaignSent = base.campaignSent
  let campaignLaunched = 0
  let campaignStepsCreated = 0

  try {
    const launch = await launchAutomaticScoutRunCampaign({
      accountId,
      configId: scout.configId,
      runId: scout.runId,
      enrollments: scout.enrollments,
    })

    if (launch.campaignId) campaignLaunched += 1
    campaignStepsCreated += launch.stepsCreated
    campaignSent += launch.sent

    if (launch.stepsCreated > 0 && launch.sent === 0) {
      const flush = await flushAutomaticOutreachPipelines(accountId)
      campaignSent += flush.campaignSent
    }
  } catch (error) {
    console.error('[automatic-pipeline] post-scout campaign launch failed', accountId, error)
  }

  return {
    ...base,
    campaignSent,
    campaignLaunched,
    campaignStepsCreated,
  }
}

export type AutomaticPipelineBatchResult = AutomaticPipelineResult & {
  accountsProcessed: number
}

/** Cron / scheduler: draft stuck sequences and send for every active automatic account. */
export async function runAutomaticPipelineForAllAccounts(): Promise<AutomaticPipelineBatchResult> {
  const configs = await db
    .select({ accountId: sdrAgentConfigs.accountId })
    .from(sdrAgentConfigs)
    .where(
      and(
        eq(sdrAgentConfigs.isActive, true),
        eq(sdrAgentConfigs.isPaused, false),
        isNull(sdrAgentConfigs.deletedAt),
      ),
    )

  const totals: AutomaticPipelineBatchResult = {
    accountsProcessed: 0,
    drafted: 0,
    draftFailed: 0,
    sdrSent: 0,
    sdrFailed: 0,
    campaignSent: 0,
    campaignLaunched: 0,
    campaignStepsCreated: 0,
    skipped: true,
  }

  for (const { accountId } of configs) {
    const result = await runAutomaticPipelineForAccount(accountId)
    if (result.skipped) continue

    totals.accountsProcessed += 1
    totals.drafted += result.drafted
    totals.draftFailed += result.draftFailed
    totals.sdrSent += result.sdrSent
    totals.sdrFailed += result.sdrFailed
    totals.campaignSent += result.campaignSent
    totals.campaignLaunched += result.campaignLaunched
    totals.campaignStepsCreated += result.campaignStepsCreated
    totals.skipped = false
  }

  return totals
}
