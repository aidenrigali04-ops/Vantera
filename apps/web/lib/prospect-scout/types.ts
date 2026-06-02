import type { ICPConfig } from '@/lib/aspire/types'
import type { sdrAgentConfigs, sdrAspireBindings, aspireSavedSearches } from '@vantera/db'

export type ProspectMode = 'aspire_bound' | 'inline_icp' | 'hybrid'

export type SdrConfigRow = typeof sdrAgentConfigs.$inferSelect
export type BindingRow = typeof sdrAspireBindings.$inferSelect
export type SavedSearchRow = typeof aspireSavedSearches.$inferSelect

export type BindingWithSearch = BindingRow & {
  search: SavedSearchRow
}

export type RunSearchResult = {
  runId: string
  searchId: string
  found: number
  enrolled: number
  status: 'success' | 'failed'
  errorMessage?: string
}

export type RunAccountResult = {
  accountId: string
  searchesRun: number
  found: number
  enrolled: number
  runs: RunSearchResult[]
}

export type EnrollProspectResult = {
  leadId: string
  aspireResultId: string
  sequenceId?: string
  enrolled: boolean
}

export function resolveIcpConfig(
  config: SdrConfigRow,
  search: SavedSearchRow,
  bindingMinScore?: number,
): ICPConfig {
  const fromSearch = search.icpConfig as ICPConfig | null
  const fromConfig = config.icpConfig as ICPConfig
  if (fromSearch && fromSearch.targetTitles?.length) return fromSearch
  return fromConfig
}

export function effectiveMinIcp(binding: BindingRow, config: SdrConfigRow): number {
  return binding.minIcpScore ?? config.defaultMinIcpScore ?? 70
}
