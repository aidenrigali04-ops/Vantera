import { db } from '@/lib/db/client'
import { sdrActivityLog } from '@vantera/db'

export async function logSdrActivity(input: {
  accountId: string
  configId: string
  eventType: string
  leadId?: string | null
  sequenceId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.insert(sdrActivityLog).values({
    accountId: input.accountId,
    configId: input.configId,
    leadId: input.leadId ?? null,
    sequenceId: input.sequenceId ?? null,
    eventType: input.eventType,
    metadata: input.metadata ?? {},
  })
}
