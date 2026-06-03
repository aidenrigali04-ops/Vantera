import { db } from '@/lib/db/client'
import { sdrSequenceSteps } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'

/** Persists reviewed draft copy onto the scheduled sequence step before send. */
export async function syncLeadDraftToSequenceStep(input: {
  accountId: string
  stepId: string
  subject: string | null
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [step] = await db
    .select({ id: sdrSequenceSteps.id })
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.id, input.stepId),
        eq(sdrSequenceSteps.accountId, input.accountId),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .limit(1)

  if (!step) {
    return { ok: false, error: 'Outreach step not found' }
  }

  await db
    .update(sdrSequenceSteps)
    .set({
      subject: input.subject,
      body: input.body,
    })
    .where(eq(sdrSequenceSteps.id, input.stepId))

  return { ok: true }
}
