import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import { findOutreachAgentConfigByAccount } from '@/lib/outreach-agent/queries'
import {
  isAutomaticOutreachMode,
  resolveOutreachAutomationMode,
} from '@/lib/sdr/outreach-automation'
import { sendDueSdrStepsForAccount } from '@/lib/sdr/send-due-for-account'
import { resolveAccountOwnerId } from '@/lib/webhooks/resend/actors'
import { accounts, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

type AccountAutomationRow = {
  plan: string
  outreachAutomationMode: string | null
  hasSdrConfig: boolean
}

async function loadAccountAutomationRow(
  accountId: string,
): Promise<AccountAutomationRow | null> {
  const [row] = await db
    .select({
      plan: accounts.plan,
      outreachAutomationMode: sdrAgentConfigs.outreachAutomationMode,
      hasSdrConfig: sdrAgentConfigs.id,
    })
    .from(accounts)
    .leftJoin(
      sdrAgentConfigs,
      and(eq(sdrAgentConfigs.accountId, accounts.id), isNull(sdrAgentConfigs.deletedAt)),
    )
    .where(eq(accounts.id, accountId))
    .limit(1)

  if (!row) return null
  return {
    plan: row.plan,
    outreachAutomationMode: row.outreachAutomationMode,
    hasSdrConfig: Boolean(row.hasSdrConfig),
  }
}

/** True when the workspace SDR hub toggle is set to Automatic outreach. */
export async function isAccountAutomaticOutreach(accountId: string): Promise<boolean> {
  const row = await loadAccountAutomationRow(accountId)
  if (!row?.hasSdrConfig) return false

  const mode = await resolveOutreachAutomationMode(
    accountId,
    row.plan as Plan,
    row.outreachAutomationMode,
  )
  return isAutomaticOutreachMode(mode)
}

/**
 * Cron / background campaign sends: allowed when there is no SDR config (campaign-only
 * accounts) or when the account-wide automatic toggle is on.
 */
export async function shouldCronAutoProcessCampaignSteps(
  accountId: string,
): Promise<boolean> {
  const row = await loadAccountAutomationRow(accountId)
  if (!row?.hasSdrConfig) return true

  const mode = await resolveOutreachAutomationMode(
    accountId,
    row.plan as Plan,
    row.outreachAutomationMode,
  )
  return isAutomaticOutreachMode(mode)
}

/**
 * Runs all automatic outbound processing for an account: SDR sequence sends and
 * Outreach Agent linked campaign queue. No-op in review mode.
 */
export async function flushAutomaticOutreachPipelines(
  accountId: string,
): Promise<{ sdrSent: number; sdrFailed: number; campaignSent: number }> {
  const empty = { sdrSent: 0, sdrFailed: 0, campaignSent: 0 }
  if (!(await isAccountAutomaticOutreach(accountId))) return empty

  const sdrSummary = await sendDueSdrStepsForAccount(accountId).catch((error) => {
    console.error('[outreach-automation] SDR send flush failed', accountId, error)
    return { sent: 0, failed: 0 }
  })

  const agent = await findOutreachAgentConfigByAccount(accountId)
  if (!agent || agent.isPaused || agent.linkedCampaignIds.length === 0) {
    return {
      sdrSent: sdrSummary.sent,
      sdrFailed: sdrSummary.failed,
      campaignSent: 0,
    }
  }

  const ownerId = await resolveAccountOwnerId(accountId)
  if (!ownerId) {
    return {
      sdrSent: sdrSummary.sent,
      sdrFailed: sdrSummary.failed,
      campaignSent: 0,
    }
  }

  const { processDueCampaignSteps } = await import('@/lib/outreach/runner')
  const campaignSummary = await processDueCampaignSteps(accountId, ownerId, {
    campaignIds: agent.linkedCampaignIds,
  }).catch((error) => {
    console.error('[outreach-automation] Outreach Agent queue flush failed', accountId, error)
    return { sent: 0, failed: 0 }
  })

  return {
    sdrSent: sdrSummary.sent,
    sdrFailed: sdrSummary.failed,
    campaignSent: campaignSummary.sent,
  }
}
