import { runDraftSdrSequence } from '@/lib/sdr/run-draft-sequence'
import type { DraftSdrSequencePayload } from '@/lib/sdr/types'
import { task } from '@trigger.dev/sdk'

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
