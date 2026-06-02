import { runDailyLeadScore } from './daily-lead-score'
import { resolveClientContext } from '@/lib/sdr/resolve-client-context'
import { task } from '@trigger.dev/sdk'

type EngagementPayload = {
  accountId: string
  contactId: string
  leadId?: string
  event: 'email_opened' | 'email_clicked' | 'email_replied'
}

/**
 * Real-time re-score hook (invoke from Resend/webhook routes).
 * Full per-lead path can be extended; currently ensures account context is valid.
 */
export const sdrEngagementUpdate = task({
  id: 'sdr-engagement-update',
  maxDuration: 30,
  queue: { name: 'sdr-score-queue', concurrencyLimit: 20 },
  run: async (payload: EngagementPayload) => {
    const ctx = await resolveClientContext(payload.accountId)
    if (!ctx) return { ok: false }

    // Batch scorer until dedicated per-lead scorer is added
    await runDailyLeadScore()

    return { ok: true, event: payload.event, leadId: payload.leadId ?? payload.contactId }
  },
})
