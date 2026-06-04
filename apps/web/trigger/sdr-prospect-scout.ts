import { runSdrAgentFind } from '@/lib/sdr/run-find'
import { schedules } from '@trigger.dev/sdk'

/**
 * Agent 01 — Prospect Scout discovery for Automatic outreach workspaces.
 * Hourly tick; each account runs once at 8:00 AM in workspace timezone (daily or Monday weekly).
 */
export const sdrProspectScout = schedules.task({
  id: 'sdr-prospect-scout',
  cron: '0 * * * *',
  maxDuration: 3600,
  run: async () => runSdrAgentFind(),
})
