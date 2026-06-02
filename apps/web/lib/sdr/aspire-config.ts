import type { ICPConfig } from '@/lib/aspire/types'
import { db } from '@/lib/db/client'
import { findSavedSearches } from '@/lib/aspire/queries'
import type { BindingWithSearch, ProspectMode } from '@/lib/prospect-scout/types'
import {
  normalizeOutreachAutomationMode,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation'
import type { CreateSDRConfigInput } from '@/lib/sdr/types'
import {
  aspireSavedSearches,
  aspireSearchRuns,
  sdrAgentConfigs,
  sdrAspireBindings,
} from '@vantera/db'
import { and, desc, eq, isNull } from 'drizzle-orm'

export type AspireBindingInput = {
  savedSearchId: string
  priority?: number
  minIcpScore?: number
  maxLeadsPerRun?: number
  autoEnrollSdr?: boolean
  isActive?: boolean
}

export type SdrAspireConfigPayload = {
  config: {
    id: string
    prospectMode: ProspectMode
    defaultMinIcpScore: number
    syncIcpToSavedSearches: boolean
    searchFrequency: string
    maxNewLeadsDay: number
    maxActiveLeads: number
    isActive: boolean
    isPaused: boolean
    icpConfig: ICPConfig
    outreachAutomationMode: OutreachAutomationMode
  } | null
  bindings: Array<{
    id: string
    savedSearchId: string
    searchName: string
    priority: number
    minIcpScore: number
    maxLeadsPerRun: number
    autoEnrollSdr: boolean
    isActive: boolean
  }>
  savedSearches: Awaited<ReturnType<typeof findSavedSearches>>
  recentRuns: Array<typeof aspireSearchRuns.$inferSelect>
}

export async function findBindingsForConfig(
  configId: string,
  searchId?: string,
): Promise<BindingWithSearch[]> {
  const rows = await db
    .select({
      binding: sdrAspireBindings,
      search: aspireSavedSearches,
    })
    .from(sdrAspireBindings)
    .innerJoin(aspireSavedSearches, eq(sdrAspireBindings.savedSearchId, aspireSavedSearches.id))
    .where(
      and(
        eq(sdrAspireBindings.configId, configId),
        eq(sdrAspireBindings.isActive, true),
        isNull(aspireSavedSearches.deletedAt),
        ...(searchId ? [eq(sdrAspireBindings.savedSearchId, searchId)] : []),
      ),
    )
    .orderBy(desc(sdrAspireBindings.priority))

  return rows.map((row) => ({
    ...row.binding,
    search: row.search,
  }))
}

export async function getSdrAspireConfig(accountId: string): Promise<SdrAspireConfigPayload> {
  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  const savedSearches = await findSavedSearches(accountId)

  const recentRuns = await db
    .select()
    .from(aspireSearchRuns)
    .where(eq(aspireSearchRuns.accountId, accountId))
    .orderBy(desc(aspireSearchRuns.runAt))
    .limit(10)

  if (!config) {
    return { config: null, bindings: [], savedSearches, recentRuns }
  }

  const bindingRows = await db
    .select({
      binding: sdrAspireBindings,
      search: aspireSavedSearches,
    })
    .from(sdrAspireBindings)
    .innerJoin(aspireSavedSearches, eq(sdrAspireBindings.savedSearchId, aspireSavedSearches.id))
    .where(eq(sdrAspireBindings.configId, config.id))
    .orderBy(desc(sdrAspireBindings.priority))

  return {
    config: {
      id: config.id,
      prospectMode: (config.prospectMode ?? 'inline_icp') as ProspectMode,
      defaultMinIcpScore: config.defaultMinIcpScore ?? 70,
      syncIcpToSavedSearches: config.syncIcpToSavedSearches ?? true,
      searchFrequency: config.searchFrequency,
      maxNewLeadsDay: config.maxNewLeadsDay,
      maxActiveLeads: config.maxActiveLeads,
      isActive: config.isActive,
      isPaused: config.isPaused,
      icpConfig: config.icpConfig as ICPConfig,
      outreachAutomationMode: normalizeOutreachAutomationMode(config.outreachAutomationMode),
    },
    bindings: bindingRows.map((row) => ({
      id: row.binding.id,
      savedSearchId: row.binding.savedSearchId,
      searchName: row.search.name,
      priority: row.binding.priority,
      minIcpScore: row.binding.minIcpScore,
      maxLeadsPerRun: row.binding.maxLeadsPerRun,
      autoEnrollSdr: row.binding.autoEnrollSdr,
      isActive: row.binding.isActive,
    })),
    savedSearches,
    recentRuns,
  }
}

export async function saveSdrAspireConfig(
  accountId: string,
  input: {
    prospectMode?: ProspectMode
    defaultMinIcpScore?: number
    syncIcpToSavedSearches?: boolean
    icpConfig?: ICPConfig
    bindings?: AspireBindingInput[]
  },
): Promise<SdrAspireConfigPayload> {
  const [config] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  if (!config) {
    throw new Error('SDR agent not configured')
  }

  if (
    input.prospectMode !== undefined ||
    input.defaultMinIcpScore !== undefined ||
    input.syncIcpToSavedSearches !== undefined ||
    input.icpConfig !== undefined
  ) {
    await db
      .update(sdrAgentConfigs)
      .set({
        ...(input.prospectMode !== undefined ? { prospectMode: input.prospectMode } : {}),
        ...(input.defaultMinIcpScore !== undefined
          ? { defaultMinIcpScore: input.defaultMinIcpScore }
          : {}),
        ...(input.syncIcpToSavedSearches !== undefined
          ? { syncIcpToSavedSearches: input.syncIcpToSavedSearches }
          : {}),
        ...(input.icpConfig !== undefined ? { icpConfig: input.icpConfig } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sdrAgentConfigs.id, config.id))
  }

  const syncIcp = input.syncIcpToSavedSearches ?? config.syncIcpToSavedSearches
  const icpToSync = input.icpConfig ?? (config.icpConfig as ICPConfig)

  if (input.bindings) {
    await db.delete(sdrAspireBindings).where(eq(sdrAspireBindings.configId, config.id))

    for (const [index, binding] of input.bindings.entries()) {
      await db.insert(sdrAspireBindings).values({
        accountId,
        configId: config.id,
        savedSearchId: binding.savedSearchId,
        priority: binding.priority ?? index,
        minIcpScore: binding.minIcpScore ?? input.defaultMinIcpScore ?? config.defaultMinIcpScore,
        maxLeadsPerRun: binding.maxLeadsPerRun ?? 25,
        autoEnrollSdr: binding.autoEnrollSdr ?? true,
        isActive: binding.isActive ?? true,
      })

      if (syncIcp) {
        await db
          .update(aspireSavedSearches)
          .set({ icpConfig: icpToSync, updatedAt: new Date() })
          .where(
            and(
              eq(aspireSavedSearches.id, binding.savedSearchId),
              eq(aspireSavedSearches.accountId, accountId),
            ),
          )
      }
    }
  }

  return getSdrAspireConfig(accountId)
}

export type { CreateSDRConfigInput }
