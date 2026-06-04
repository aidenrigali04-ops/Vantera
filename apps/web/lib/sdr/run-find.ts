import { shouldRunProspectScoutOnSchedule } from '@/lib/prospect-scout/schedule'
import { runAccountProspectScout } from '@/lib/prospect-scout/run-account'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { isAccountAutomaticOutreach } from '@/lib/sdr/outreach-automation-account'
import { requireSDREnabledForAccount } from '@/lib/sdr/guard'
import type { SdrOutreachWindow } from '@/lib/sdr/types'
import { accounts, featureFlags, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Scheduled Prospect Scout: automatic outreach workspaces only, daily at 8:00 AM local.
 * Each run discovers leads, drafts sequences, launches scout campaigns, and flushes due sends.
 */
export async function runSdrAgentFind(): Promise<{ accountsRun: number; leadsEnrolled: number }> {
  const configs = await db
    .select({
      config: sdrAgentConfigs,
      plan: accounts.plan,
      timezone: accounts.timezone,
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

  let accountsRun = 0
  let leadsEnrolled = 0
  const now = new Date()

  for (const { config, plan, timezone } of configs) {
    try {
      await requireSDREnabledForAccount(config.accountId, plan as Plan)
    } catch {
      continue
    }

    if (!(await isAccountAutomaticOutreach(config.accountId))) {
      continue
    }

    if (!shouldRunProspectScoutOnSchedule(config, { now, timezone })) {
      continue
    }

    try {
      const result = await runAccountProspectScout(config.accountId)
      if (result.searchesRun > 0 || result.enrolled > 0 || result.found > 0) accountsRun += 1
      leadsEnrolled += result.enrolled
    } catch (error) {
      console.error('[sdr-agent-find] account failed:', config.accountId, error)
    }

    await sleep(300)
  }

  return { accountsRun, leadsEnrolled }
}

export async function isSdrFlagEnabled(accountId: string, plan: Plan): Promise<boolean> {
  const [row] = await db
    .select({ isEnabled: featureFlags.isEnabled })
    .from(featureFlags)
    .where(and(eq(featureFlags.accountId, accountId), eq(featureFlags.flagName, 'sdr_agent_enabled')))
    .limit(1)

  if (row) return row.isEnabled
  return evaluateFlag({ accountId, plan, flagName: 'sdr_agent_enabled' })
}

export type { SdrOutreachWindow }
