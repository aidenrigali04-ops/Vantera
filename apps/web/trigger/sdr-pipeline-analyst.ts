import { runDailyLeadScore } from './daily-lead-score'
import { schedules } from '@trigger.dev/sdk'

/** Agent 04 — daily composite scoring + action feed signals. */
export const sdrPipelineAnalyst = schedules.task({
  id: 'sdr-pipeline-analyst',
  cron: '30 7 * * *',
  maxDuration: 900,
  run: async () => runDailyLeadScore(),
})
