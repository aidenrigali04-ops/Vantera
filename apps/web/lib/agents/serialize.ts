import type { SdrOutreachWindow } from '@/lib/sdr/types'

/** Strip class instances (e.g. Date) so RSC → client props serialize in production. */
export function serializeForClient<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export type HubAgentConfigSummary = {
  agentName: string
  isActive: boolean
  isPaused: boolean
  searchFrequency: 'daily' | 'weekly'
  outreachWindow: SdrOutreachWindow
}

export function toHubAgentConfigSummary(
  config: {
    agentName: string
    isActive: boolean
    isPaused: boolean
    searchFrequency: 'daily' | 'weekly'
    outreachWindow: SdrOutreachWindow
  } | null,
): HubAgentConfigSummary | null {
  if (!config) return null
  return {
    agentName: config.agentName,
    isActive: config.isActive,
    isPaused: config.isPaused,
    searchFrequency: config.searchFrequency,
    outreachWindow: config.outreachWindow,
  }
}
