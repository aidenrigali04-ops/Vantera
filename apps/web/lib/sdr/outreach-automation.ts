import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import {
  normalizeOutreachAutomationMode,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'
import { featureFlags, sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

export type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation-mode'
export {
  OUTREACH_AUTOMATION_LABELS,
  isAutomaticOutreachMode,
  normalizeOutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'

/** Account-level setting: config column wins; legacy flag is fallback only when column missing. */
export async function resolveOutreachAutomationMode(
  accountId: string,
  plan: Plan,
  configMode?: string | null,
): Promise<OutreachAutomationMode> {
  if (configMode != null && configMode !== '') {
    return normalizeOutreachAutomationMode(configMode)
  }

  const [row] = await db
    .select({ outreachAutomationMode: sdrAgentConfigs.outreachAutomationMode })
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (row?.outreachAutomationMode) {
    return normalizeOutreachAutomationMode(row.outreachAutomationMode)
  }

  const legacyAutonomous = await evaluateFlag({
    accountId,
    plan,
    flagName: 'autonomous_ai_messaging',
  })

  return legacyAutonomous ? 'automatic' : 'review'
}

/** Persist mode on config and mirror to feature_flags for backward-compatible send guards. */
export async function setOutreachAutomationMode(
  accountId: string,
  mode: OutreachAutomationMode,
): Promise<void> {
  await db
    .update(sdrAgentConfigs)
    .set({
      outreachAutomationMode: mode,
      updatedAt: new Date(),
    })
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))

  await db
    .insert(featureFlags)
    .values({
      accountId,
      flagName: 'autonomous_ai_messaging',
      isEnabled: mode === 'automatic',
    })
    .onConflictDoUpdate({
      target: [featureFlags.accountId, featureFlags.flagName],
      set: {
        isEnabled: mode === 'automatic',
        updatedAt: new Date(),
      },
    })
}
