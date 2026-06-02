'use server'

import type { ActionResult } from '@/lib/auth/types'
import { findSavedSearches } from '@/lib/aspire/queries'
import { getIcpConfigForVertical } from '@/lib/aspire/icp-score'
import { db } from '@/lib/db/client'
import { queueProspectScoutDiscovery } from '@/lib/prospect-scout/queue-discovery'
import type { RunAccountResult } from '@/lib/prospect-scout/types'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import { saveSdrAspireConfig } from '@/lib/sdr/aspire-config'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { createSDRConfig, updateSDRConfig } from '@/lib/sdr/config'
import { requireSDREnabled } from '@/lib/sdr/guard'
import type { CreateSDRConfigInput, ProspectMode } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import { accounts, sdrAgentConfigs, users } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export type LaunchSdrAgentInput = CreateSDRConfigInput & {
  bindings?: AspireBindingInput[]
}

async function rollbackConfig(accountId: string): Promise<void> {
  await db
    .update(sdrAgentConfigs)
    .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
}

async function validateProspectMode(
  accountId: string,
  mode: ProspectMode | undefined,
  bindings: AspireBindingInput[] | undefined,
): Promise<string | null> {
  const prospectMode = mode ?? 'inline_icp'
  if (prospectMode === 'inline_icp' || prospectMode === 'hybrid') return null

  if (bindings && bindings.length > 0) return null

  const saved = await findSavedSearches(accountId)
  if (saved.length === 0) {
    return 'Create at least one Aspire saved search before using Aspire-bound mode, or switch to inline ICP discovery.'
  }

  return 'Add at least one saved search binding for Aspire-bound mode.'
}

async function normalizeLaunchInput(
  accountId: string,
  userId: string,
  input: LaunchSdrAgentInput,
): Promise<LaunchSdrAgentInput | { error: string }> {
  if (!input.agentName?.trim()) {
    return { error: 'Agent name is required' }
  }

  const [account] = await db
    .select({
      name: accounts.name,
      vertical: accounts.vertical,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const fromEmail = input.fromEmail?.trim() || user?.email?.trim() || ''
  if (!fromEmail) {
    return { error: 'Could not resolve a workspace email for this agent' }
  }

  const agentName = input.agentName.trim()
  const accountName = account?.name?.trim() || 'Your workspace'
  const vertical = account?.vertical ?? 'agency'

  return {
    ...input,
    agentName,
    agentTitle: 'Prospecting Agent',
    fromEmail,
    fromName: input.fromName?.trim() || `${agentName} · ${accountName}`,
    signature: null,
    icpConfig: input.icpConfig ?? getIcpConfigForVertical(vertical),
    targetVerticals: input.targetVerticals ?? [vertical],
    outreachWindow: DEFAULT_OUTREACH_WINDOW,
    maxActiveLeads: input.maxActiveLeads ?? 200,
    isActive: input.isActive ?? true,
  }
}

async function queueBootstrapDiscovery(
  accountId: string,
): Promise<RunAccountResult | { queued: true }> {
  return queueProspectScoutDiscovery(accountId)
}

/**
 * Atomic setup: config → aspire bindings → activate → first discovery run.
 * Rolls back config if aspire save or activation fails.
 */
export async function launchSdrAgent(
  input: LaunchSdrAgentInput,
): Promise<ActionResult<{ bootstrap: RunAccountResult | { queued: true } | null }>> {
  const { accountId, userId } = await requireSDREnabled()

  const normalized = await normalizeLaunchInput(accountId, userId, input)
  if ('error' in normalized) {
    return { success: false, error: normalized.error }
  }

  const validationError = await validateProspectMode(
    accountId,
    normalized.prospectMode,
    normalized.bindings,
  )
  if (validationError) {
    return { success: false, error: validationError }
  }

  const createResult = await createSDRConfig({ ...normalized, isActive: false })
  if (!createResult.success) {
    return createResult
  }

  const configId = createResult.data!.id

  try {
    await saveSdrAspireConfig(accountId, {
      prospectMode: normalized.prospectMode,
      defaultMinIcpScore: normalized.defaultMinIcpScore,
      syncIcpToSavedSearches: normalized.syncIcpToSavedSearches,
      icpConfig: normalized.icpConfig,
      bindings: normalized.bindings,
    })
  } catch (error) {
    await rollbackConfig(accountId)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Prospect Scout configuration failed',
    }
  }

  const activateResult = await updateSDRConfig({ isActive: true })
  if (!activateResult.success) {
    await rollbackConfig(accountId)
    return activateResult
  }

  await logSdrActivity({
    accountId,
    configId,
    eventType: 'agent_launched',
    metadata: {
      agentName: normalized.agentName,
      prospectMode: normalized.prospectMode ?? 'inline_icp',
      searchFrequency: normalized.searchFrequency ?? 'daily',
    },
  })

  const bootstrap = await queueBootstrapDiscovery(accountId)

  revalidatePath('/admin/outreach/agents')
  revalidatePath('/admin/outreach/agents/scout')

  return { success: true, data: { bootstrap } }
}
