import { runSdrAgentFind } from '@/lib/sdr/run-find'
import { schedules } from '@trigger.dev/sdk'

/** Agent 01 — weekly prospect discovery for all active SDR accounts (Apollo + Aspire bindings). */
export const sdrProspectScout = schedules.task({
  id: 'sdr-prospect-scout',
  cron: '0 6 * * MON',
  maxDuration: 3600,
  run: async () => runSdrAgentFind(),
})
