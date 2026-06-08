import { isExploriumConfigured } from '@/lib/aspire/explorium-client'
import { env } from '@/lib/env'
import { tasks } from '@trigger.dev/sdk'

export class TriggerNotConfiguredError extends Error {
  constructor() {
    super(
      'Trigger.dev is not connected. Set TRIGGER_SECRET_KEY and TRIGGER_PROJECT_REF, then run pnpm trigger:deploy.',
    )
    this.name = 'TriggerNotConfiguredError'
  }
}

export function isTriggerConfigured(): boolean {
  return Boolean(env.TRIGGER_SECRET_KEY?.trim())
}

/** Queue the SDR bootstrap discovery task in Trigger.dev. */
export async function triggerSdrBootstrapDiscovery(accountId: string): Promise<{ runId: string }> {
  if (!isTriggerConfigured()) {
    throw new TriggerNotConfiguredError()
  }

  const handle = await tasks.trigger('sdr-bootstrap-discovery', { accountId })
  const runId = handle.id

  if (!runId) {
    throw new Error('Trigger accepted the job but did not return a run id')
  }

  return { runId }
}

export type SdrPipelineDiagnostics = {
  triggerConfigured: boolean
  exploriumConfigured: boolean
  triggerProjectRef: string | null
}

export function getSdrPipelineDiagnostics(): SdrPipelineDiagnostics {
  return {
    triggerConfigured: isTriggerConfigured(),
    exploriumConfigured: isExploriumConfigured(),
    triggerProjectRef: process.env.TRIGGER_PROJECT_REF?.trim() || null,
  }
}
