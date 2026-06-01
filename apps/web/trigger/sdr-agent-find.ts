import { runSdrAgentFind } from '@/lib/sdr/run-find'
import { schedules } from '@trigger.dev/sdk'

export async function runSdrAgentFindJob() {
  return runSdrAgentFind()
}

export const sdrAgentFind = schedules.task({
  id: 'sdr-agent-find',
  cron: '0 7 * * *',
  maxDuration: 1800,
  run: async () => runSdrAgentFind(),
})
