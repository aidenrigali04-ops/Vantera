import { runAutomaticPipelineForAllAccounts } from '@/lib/sdr/automatic-pipeline'
import { diagnoseOutreachSend } from '@/lib/sdr/diagnose-outreach-send'
import { schedules } from '@trigger.dev/sdk'

/** Agent 03 — automatic mode: draft pending sequences, send SDR + linked campaign steps. */
export const sdrOutreachScheduler = schedules.task({
  id: 'sdr-outreach-scheduler',
  cron: '0 9 * * *',
  maxDuration: 600,
  run: async () => {
    const pipeline = await runAutomaticPipelineForAllAccounts()
    const diagnostics = await diagnoseOutreachSend()
    const sent = pipeline.sdrSent + pipeline.campaignSent
    const failed = pipeline.sdrFailed

    return {
      sent,
      failed,
      pipeline,
      summary:
        sent > 0 || failed > 0
          ? `Drafted ${pipeline.drafted}, sent ${pipeline.sdrSent} SDR + ${pipeline.campaignSent} campaign (${failed} failed)`
          : diagnostics.readyToSendTotal === 0
            ? 'No sends — see diagnostics.accounts and pipelineHints'
            : 'No sends this run (check window/mode or Manual outreach)',
      diagnostics,
    }
  },
})
