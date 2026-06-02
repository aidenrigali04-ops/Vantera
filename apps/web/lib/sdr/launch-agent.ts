'use server'

import type { ActionResult } from '@/lib/auth/types'
import { findSavedSearches } from '@/lib/aspire/queries'
import { db } from '@/lib/db/client'
import { runProspectScoutBootstrap } from '@/lib/prospect-scout/bootstrap'
import type { RunAccountResult } from '@/lib/prospect-scout/types'
import type { AspireBindingInput } from '@/lib/sdr/aspire-config'
import { saveSdrAspireConfig } from '@/lib/sdr/aspire-config'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { createSDRConfig, updateSDRConfig } from '@/lib/sdr/config'
import { requireSDREnabled } from '@/lib/sdr/guard'
import type { CreateSDRConfigInput, ProspectMode } from '@/lib/sdr/types'
import { sdrAgentConfigs } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { tasks } from '@trigger.dev/sdk'

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

async function queueBootstrapDiscovery(accountId: string): Promise<RunAccountResult | { queued: true }> {
  try {
    await tasks.trigger('sdr-bootstrap-discovery', { accountId })
    return { queued: true }
  } catch {
    return (await runProspectScoutBootstrap(accountId)) ?? { accountId, searchesRun: 0, found: 0, enrolled: 0, runs: [] }
  }
}

/**
 * Atomic setup: config → aspire bindings → activate → first discovery run.
 * Rolls back config if aspire save or activation fails.
 */
export async function launchSdrAgent(
  input: LaunchSdrAgentInput,
): Promise<ActionResult<{ bootstrap: RunAccountResult | { queued: true } | null }>> {
  const { accountId } = await requireSDREnabled()

  const validationError = await validateProspectMode(
    accountId,
    input.prospectMode,
    input.bindings,
  )
  if (validationError) {
    return { success: false, error: validationError }
  }

  const createResult = await createSDRConfig({ ...input, isActive: false })
  if (!createResult.success) {
    return createResult
  }

  const configId = createResult.data!.id

  try {
    await saveSdrAspireConfig(accountId, {
      prospectMode: input.prospectMode,
      defaultMinIcpScore: input.defaultMinIcpScore,
      syncIcpToSavedSearches: input.syncIcpToSavedSearches,
      icpConfig: input.icpConfig,
      bindings: input.bindings,
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
      agentName: input.agentName,
      prospectMode: input.prospectMode ?? 'inline_icp',
      searchFrequency: input.searchFrequency ?? 'daily',
    },
  })

  const bootstrap = await queueBootstrapDiscovery(accountId)

  revalidatePath('/admin/outreach/agents')
  revalidatePath('/admin/outreach/agents/scout')

  return { success: true, data: { bootstrap } }
}
