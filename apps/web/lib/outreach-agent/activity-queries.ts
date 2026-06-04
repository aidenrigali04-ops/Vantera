import { db } from '@/lib/db/client'
import { isOutreachAgentActivityEvent } from '@/lib/outreach-agent/activity-events'
import type { SDRActivityEvent } from '@/lib/sdr/types'
import { leads, sdrActivityLog } from '@vantera/db'
import { desc, eq } from 'drizzle-orm'

const FETCH_MULTIPLIER = 4

export async function getOutreachAgentActivityFeed(
  accountId: string,
  limit = 50,
): Promise<SDRActivityEvent[]> {
  const fetchLimit = Math.min(limit * FETCH_MULTIPLIER, 200)
  const rows = await db
    .select({
      log: sdrActivityLog,
      firstName: leads.firstName,
      lastName: leads.lastName,
      company: leads.company,
    })
    .from(sdrActivityLog)
    .leftJoin(leads, eq(sdrActivityLog.leadId, leads.id))
    .where(eq(sdrActivityLog.accountId, accountId))
    .orderBy(desc(sdrActivityLog.createdAt))
    .limit(fetchLimit)

  const events: SDRActivityEvent[] = []
  for (const { log, firstName, lastName, company } of rows) {
    const metadata = (log.metadata ?? {}) as Record<string, unknown>
    if (!isOutreachAgentActivityEvent(log.eventType, metadata)) continue
    events.push({
      id: log.id,
      eventType: log.eventType,
      leadId: log.leadId,
      sequenceId: log.sequenceId,
      metadata,
      createdAt: log.createdAt.toISOString(),
      leadName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      company: company ?? undefined,
    })
    if (events.length >= limit) break
  }
  return events
}
