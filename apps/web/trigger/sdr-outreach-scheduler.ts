import { runSdrAgentSend } from '@/lib/sdr/run-send'
import { schedules } from '@trigger.dev/sdk'

/** Agent 03 — send due email/SMS steps (client from-address, autonomous flag enforced). */
export const sdrOutreachScheduler = schedules.task({
  id: 'sdr-outreach-scheduler',
  cron: '0 9 * * *',
  maxDuration: 600,
  run: async () => runSdrAgentSend(),
})
