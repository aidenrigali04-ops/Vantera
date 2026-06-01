import {
  runDraftOnEnroll,
  type DraftOnEnrollPayload,
} from '@/lib/aspire/draft-on-enroll-runner'
import { task } from '@trigger.dev/sdk'

export type { DraftOnEnrollPayload }

export { runDraftOnEnroll }

export const draftOnEnroll = task({
  id: 'draft-on-enroll',
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
  },
  run: async (payload: DraftOnEnrollPayload) => runDraftOnEnroll(payload),
})
