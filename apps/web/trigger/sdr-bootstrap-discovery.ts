import { runProspectScoutBootstrap } from '@/lib/prospect-scout/bootstrap'
import { task } from '@trigger.dev/sdk'

/** First-run discovery after setup — avoids serverless timeouts on Apify runs. */
export const sdrBootstrapDiscovery = task({
  id: 'sdr-bootstrap-discovery',
  maxDuration: 600,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 30_000,
  },
  run: async (payload: { accountId: string }) => {
    const result = await runProspectScoutBootstrap(payload.accountId)
    if (!result) {
      return { skipped: true, reason: 'Agent not active' }
    }
    return result
  },
})
