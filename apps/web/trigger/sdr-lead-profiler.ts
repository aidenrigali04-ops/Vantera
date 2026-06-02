import { runDraftSdrSequence } from '@/lib/sdr/run-draft-sequence'
import type { DraftSdrSequencePayload } from '@/lib/sdr/types'
import { task } from '@trigger.dev/sdk'

/** Agent 02 — DISC-aware sequence copy in the client's voice. */
export const sdrLeadProfiler = task({
  id: 'sdr-lead-profiler',
  maxDuration: 120,
  queue: { name: 'sdr-profiler-queue', concurrencyLimit: 3 },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 15_000,
    maxTimeoutInMs: 120_000,
  },
  run: async (payload: DraftSdrSequencePayload) => runDraftSdrSequence(payload),
})

/** @deprecated Use sdr-lead-profiler — kept for existing triggers. */
export const draftSdrSequence = task({
  id: 'draft-sdr-sequence',
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 15_000,
  },
  run: async (payload: DraftSdrSequencePayload) => runDraftSdrSequence(payload),
})
