import type { ICPConfig } from '@/lib/aspire/types'
import type { SDRAgentConfig, SdrOutreachWindow } from '@/lib/sdr/types'
import { DEFAULT_OUTREACH_WINDOW } from '@/lib/sdr/types'
import type { sdrAgentConfigs } from '@vantera/db'

export function mapSdrAgentConfigRow(
  row: typeof sdrAgentConfigs.$inferSelect,
): SDRAgentConfig {
  const contacted = row.totalContacted ?? 0
  const replied = row.totalReplied ?? 0
  const booked = row.totalBooked ?? 0

  return {
    id: row.id,
    accountId: row.accountId,
    agentName: row.agentName,
    agentTitle: row.agentTitle,
    fromEmail: row.fromEmail,
    fromName: row.fromName,
    signature: row.signature,
    icpConfig: row.icpConfig as ICPConfig,
    targetVerticals: row.targetVerticals ?? [],
    targetCities: row.targetCities ?? [],
    excludeDomains: row.excludeDomains ?? [],
    searchFrequency: (row.searchFrequency as 'daily' | 'weekly') ?? 'daily',
    outreachDays: row.outreachDays ?? ['mon', 'tue', 'wed', 'thu', 'fri'],
    outreachWindow: (row.outreachWindow as SdrOutreachWindow) ?? DEFAULT_OUTREACH_WINDOW,
    maxNewLeadsDay: row.maxNewLeadsDay,
    maxActiveLeads: row.maxActiveLeads,
    prospectMode: (row.prospectMode ?? 'inline_icp') as SDRAgentConfig['prospectMode'],
    defaultMinIcpScore: row.defaultMinIcpScore ?? 70,
    syncIcpToSavedSearches: row.syncIcpToSavedSearches ?? true,
    isActive: row.isActive,
    isPaused: row.isPaused,
    pausedReason: row.pausedReason,
    stats: {
      totalLeadsFound: row.totalLeadsFound,
      totalContacted: contacted,
      totalReplied: replied,
      totalBooked: booked,
      replyRate: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
      bookingRate: replied > 0 ? Math.round((booked / replied) * 100) : 0,
    },
  }
}
