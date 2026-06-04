import { db } from '@/lib/db/client'
import type { Plan } from '@/lib/feature-flags/flags'
import {
  isAutomaticOutreachMode,
  resolveOutreachAutomationMode,
} from '@/lib/sdr/outreach-automation'
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
