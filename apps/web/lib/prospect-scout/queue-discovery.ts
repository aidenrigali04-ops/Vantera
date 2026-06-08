import { runProspectScoutBootstrap } from '@/lib/prospect-scout/bootstrap'
import type { RunAccountResult } from '@/lib/prospect-scout/types'
import {
  getSdrPipelineDiagnostics,
  isTriggerConfigured,
  triggerSdrBootstrapDiscovery,
  TriggerNotConfiguredError,
} from '@/lib/trigger/sdr-pipeline'

export type QueueDiscoveryResult =
  | (RunAccountResult & { mode: 'sync' })
  | { queued: true; mode: 'trigger'; triggerRunId: string }
  | { queued: false; mode: 'failed'; error: string; diagnostics: ReturnType<typeof getSdrPipelineDiagnostics> }

/**
 * Prefer Trigger.dev for long prospect-search runs (avoids Vercel timeouts).
 * Falls back to synchronous bootstrap when Trigger is unavailable.
 */
export async function queueProspectScoutDiscovery(
  accountId: string,
): Promise<QueueDiscoveryResult> {
  const diagnostics = getSdrPipelineDiagnostics()

  if (isTriggerConfigured()) {
    try {
      const { runId } = await triggerSdrBootstrapDiscovery(accountId)
      return { queued: true, mode: 'trigger', triggerRunId: runId }
    } catch (err) {
      const message =
        err instanceof TriggerNotConfiguredError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not queue discovery in Trigger.dev'
      console.error('[queueProspectScoutDiscovery] trigger failed, trying sync bootstrap', err)

      if (!diagnostics.exploriumConfigured) {
        return {
          queued: false,
          mode: 'failed',
          error: `${message}. Explorium is also not configured (EXPLORIUM_API_KEY missing).`,
          diagnostics,
        }
      }
    }
  } else {
    console.warn('[queueProspectScoutDiscovery] TRIGGER_SECRET_KEY missing — using sync bootstrap')
  }

  try {
    const result = await runProspectScoutBootstrap(accountId)
    if (result) {
      return { ...result, mode: 'sync' }
    }

    return {
      queued: false,
      mode: 'failed',
      error: 'Prospect Scout is not active for this account.',
      diagnostics,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Discovery bootstrap failed'
    console.error('[queueProspectScoutDiscovery] sync bootstrap failed', err)
    return {
      queued: false,
      mode: 'failed',
      error: message,
      diagnostics,
    }
  }
}
