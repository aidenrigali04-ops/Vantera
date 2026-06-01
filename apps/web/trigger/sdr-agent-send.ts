import { runSdrAgentSend } from '@/lib/sdr/run-send'
import { schedules } from '@trigger.dev/sdk'

export const sdrAgentSend = schedules.task({
  id: 'sdr-agent-send',
  cron: '0 * * * *',
  maxDuration: 300,
  run: async () => runSdrAgentSend(),
})
