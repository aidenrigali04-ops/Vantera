import { runSdrAgentFind } from '@/lib/sdr/run-find'
import { schedules } from '@trigger.dev/sdk'

/** Agent 01 — scheduled Prospect Scout discovery (daily or weekly per account config). */
export const sdrProspectScout = schedules.task({
  id: 'sdr-prospect-scout',
  cron: '0 6 * * *',
  maxDuration: 3600,
  run: async () => runSdrAgentFind(),
})
