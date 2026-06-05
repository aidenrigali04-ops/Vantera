import { schedules, task } from '@trigger.dev/sdk'
import { findPendingSteps } from '@/lib/linkedin/queries'

/**
 * Legacy `linkedin_sequence_steps` table — production LinkedIn sends use
 * `outreach_campaign_steps` + `sdr_sequence_steps` via the Chrome extension
 * (`/api/extension/linkedin/*`).
 */
export const linkedinSequenceRunner = schedules.task({
  id: 'linkedin-sequence-runner',
  cron: '0 9 * * *',
  run: async () => {
    const accountIds = process.env.DEBUG_TEST_ACCOUNT_ID_TEAM
      ? [process.env.DEBUG_TEST_ACCOUNT_ID_TEAM]
      : []

    let pending = 0
    for (const accountId of accountIds) {
      const steps = await findPendingSteps(accountId, 50)
      pending += steps.length
    }

    return {
      processed: 0,
      pendingLegacySteps: pending,
      message: 'Use Vantera LinkedIn extension for campaign/SDR queue sends',
    }
  },
})

export const aspireEnrichmentSync = schedules.task({
  id: 'aspire-enrichment-sync',
  cron: '0 6 * * *',
  run: async () => {
    return { refreshed: 0, message: 'Aspire enrichment sync stub' }
  },
})

export const linkedinSequenceRunnerTask = task({
  id: 'linkedin-sequence-runner-manual',
  run: async (payload: { accountId: string }) => {
    const steps = await findPendingSteps(payload.accountId, 100)
    return { pending: steps.length, usesExtension: true }
  },
})
