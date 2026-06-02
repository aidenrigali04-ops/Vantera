import { runProspectScoutBootstrap } from '@/lib/prospect-scout/bootstrap'
import type { RunAccountResult } from '@/lib/prospect-scout/types'
import { tasks } from '@trigger.dev/sdk'

export type QueueDiscoveryResult = RunAccountResult | { queued: true }

/**
 * Prefer Trigger.dev for long Apify runs (avoids Vercel timeouts).
 * Falls back to a synchronous bootstrap when Trigger is unavailable.
 */
export async function queueProspectScoutDiscovery(
  accountId: string,
): Promise<QueueDiscoveryResult> {
  try {
    await tasks.trigger('sdr-bootstrap-discovery', { accountId })
    return { queued: true }
  } catch (err) {
    console.error('[queueProspectScoutDiscovery] trigger failed, trying sync bootstrap', err)
  }

  try {
    const result = await runProspectScoutBootstrap(accountId)
    if (result) return result
  } catch (err) {
    console.error('[queueProspectScoutDiscovery] sync bootstrap failed', err)
  }

  return { queued: true }
}
