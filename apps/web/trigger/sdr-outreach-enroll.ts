import { logSdrActivity } from '@/lib/sdr/activity-log'
import { resolveClientContext } from '@/lib/sdr/resolve-client-context'
import { createIntelligenceSignal } from '@/lib/webhooks/resend/signals'
import { db } from '@/lib/db/client'
import { leads, sdrSequences } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { task } from '@trigger.dev/sdk'

type EnrollPayload = {
  accountId: string
  sequenceId: string
  leadId: string
}

/** Agent 03 — mark sequence active and log enrollment (profiler runs separately). */
export const sdrOutreachEnroll = task({
  id: 'sdr-outreach-enroll',
  maxDuration: 60,
  queue: { name: 'sdr-enroll-queue', concurrencyLimit: 10 },
  run: async (payload: EnrollPayload) => {
    const ctx = await resolveClientContext(payload.accountId)
    if (!ctx) return { ok: false, reason: 'sdr_not_configured' }

    const [lead] = await db
      .select({
        firstName: leads.firstName,
        lastName: leads.lastName,
        company: leads.company,
      })
      .from(leads)
      .where(and(eq(leads.id, payload.leadId), eq(leads.accountId, payload.accountId)))
      .limit(1)

    const [sequence] = await db
      .select({ configId: sdrSequences.configId })
      .from(sdrSequences)
      .where(
        and(eq(sdrSequences.id, payload.sequenceId), eq(sdrSequences.accountId, payload.accountId)),
      )
      .limit(1)

    if (!sequence) return { ok: false, reason: 'sequence_not_found' }

    await db
      .update(sdrSequences)
      .set({ status: 'active' })
      .where(
        and(eq(sdrSequences.id, payload.sequenceId), eq(sdrSequences.accountId, payload.accountId)),
      )

    await logSdrActivity({
      accountId: payload.accountId,
      configId: sequence.configId,
      leadId: payload.leadId,
      sequenceId: payload.sequenceId,
      eventType: 'sequence_started',
      metadata: { source: 'sdr-outreach-enroll' },
    })

    const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || 'prospect'
    await createIntelligenceSignal({
      accountId: payload.accountId,
      signalType: 'sdr_sequence_started',
      severity: 'green',
      headline: `${ctx.agentName} enrolled ${name} at ${lead?.company ?? 'their company'}`,
      actionLabel: 'View sequence',
      actionPayload: { sequenceId: payload.sequenceId },
      expiresInDays: 3,
    })

    return { ok: true }
  },
})
