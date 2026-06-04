import { db } from '@/lib/db/client'
import type { SDRActivityEvent, SDRDashboardStats } from '@/lib/sdr/types'
import {
  leads,
  records,
  sdrActivityLog,
  sdrAgentConfigs,
  sdrSequenceSteps,
  sdrSequences,
} from '@vantera/db'
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'

export async function findSdrConfigByAccount(accountId: string) {
  const [row] = await db
    .select()
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function getSdrDashboardStats(accountId: string): Promise<SDRDashboardStats> {
  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000)

  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.accountId, accountId),
        eq(sdrSequences.status, 'active'),
        isNull(sdrSequences.deletedAt),
      ),
    )

  const [enrolledToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrActivityLog)
    .where(
      and(
        eq(sdrActivityLog.accountId, accountId),
        eq(sdrActivityLog.eventType, 'lead_enrolled'),
        gte(sdrActivityLog.createdAt, startOfDay),
      ),
    )

  const sentToday = await db
    .select({ channel: sdrSequenceSteps.channel, count: sql<number>`count(*)::int` })
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.status, 'sent'),
        gte(sdrSequenceSteps.sentAt, startOfDay),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .groupBy(sdrSequenceSteps.channel)

  const [repliesWeek] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.accountId, accountId),
        gte(sdrSequences.repliedAt, weekAgo),
        isNull(sdrSequences.deletedAt),
      ),
    )

  const [bookedWeek] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.accountId, accountId),
        gte(sdrSequences.bookedAt, weekAgo),
        isNull(sdrSequences.deletedAt),
      ),
    )

  const [config] = await db
    .select({
      contacted: sdrAgentConfigs.totalContacted,
      replied: sdrAgentConfigs.totalReplied,
      booked: sdrAgentConfigs.totalBooked,
    })
    .from(sdrAgentConfigs)
    .where(and(eq(sdrAgentConfigs.accountId, accountId), isNull(sdrAgentConfigs.deletedAt)))
    .limit(1)

  const [pipelineValue] = await db
    .select({ total: sql<number>`coalesce(sum(${records.valueCents}), 0)::int` })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        eq(records.source, 'sdr_agent'),
        gte(records.createdAt, monthAgo),
        isNull(records.deletedAt),
      ),
    )

  const emailsToday =
    sentToday.find((row) => row.channel === 'email')?.count ?? 0
  const smsToday = sentToday.find((row) => row.channel === 'sms')?.count ?? 0
  const contacted = config?.contacted ?? 0
  const replied = config?.replied ?? 0
  const booked = config?.booked ?? 0

  return {
    activeSequences: activeRow?.count ?? 0,
    leadsFoundToday: enrolledToday?.count ?? 0,
    emailsSentToday: emailsToday,
    smsSentToday: smsToday,
    repliesThisWeek: repliesWeek?.count ?? 0,
    meetingsThisWeek: bookedWeek?.count ?? 0,
    replyRate30d: contacted > 0 ? Math.round((replied / contacted) * 100) : 0,
    bookingRate30d: replied > 0 ? Math.round((booked / replied) * 100) : 0,
    pipelineAdded30d: pipelineValue?.total ?? 0,
    topPerformingStep: null,
  }
}

export async function getSdrActivityFeed(
  accountId: string,
  limit = 50,
): Promise<SDRActivityEvent[]> {
  const { isScoutActivityEvent } = await import('@/lib/outreach-agent/activity-events')
  const fetchLimit = Math.min(limit * 4, 200)
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
    if (!isScoutActivityEvent(log.eventType, metadata)) continue
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

export async function getUpcomingSdrSends(accountId: string, limit = 5) {
  const now = new Date()
  return db
    .select({
      step: sdrSequenceSteps,
      firstName: leads.firstName,
      lastName: leads.lastName,
      company: leads.company,
    })
    .from(sdrSequenceSteps)
    .innerJoin(leads, eq(sdrSequenceSteps.leadId, leads.id))
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.status, 'scheduled'),
        gte(sdrSequenceSteps.scheduledFor, now),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .orderBy(sdrSequenceSteps.scheduledFor)
    .limit(limit)
}

export async function listSdrSequences(
  accountId: string,
  filters: { status?: string; limit?: number; offset?: number } = {},
) {
  const conditions = [eq(sdrSequences.accountId, accountId), isNull(sdrSequences.deletedAt)]
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(sdrSequences.status, filters.status))
  }

  return db
    .select({
      sequence: sdrSequences,
      firstName: leads.firstName,
      lastName: leads.lastName,
      company: leads.company,
      score: leads.score,
      source: leads.source,
    })
    .from(sdrSequences)
    .innerJoin(leads, eq(sdrSequences.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(sdrSequences.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0)
}

export async function getSdrSequenceDetail(accountId: string, sequenceId: string) {
  const [sequence] = await db
    .select()
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.id, sequenceId),
        eq(sdrSequences.accountId, accountId),
        isNull(sdrSequences.deletedAt),
      ),
    )
    .limit(1)

  if (!sequence) return null

  const steps = await db
    .select()
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.sequenceId, sequenceId),
        eq(sdrSequenceSteps.accountId, accountId),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .orderBy(sdrSequenceSteps.stepNumber)

  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, sequence.leadId))
    .limit(1)

  return { sequence, steps, lead: lead ?? null }
}

export async function countActiveSdrSequences(accountId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrSequences)
    .where(
      and(
        eq(sdrSequences.accountId, accountId),
        eq(sdrSequences.status, 'active'),
        isNull(sdrSequences.deletedAt),
      ),
    )
  return row?.count ?? 0
}

export async function countSdrEnrolledToday(accountId: string): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sdrActivityLog)
    .where(
      and(
        eq(sdrActivityLog.accountId, accountId),
        eq(sdrActivityLog.eventType, 'lead_enrolled'),
        gte(sdrActivityLog.createdAt, startOfDay),
      ),
    )
  return row?.count ?? 0
}

export async function findDueSdrSteps(accountId: string, limit = 50) {
  const now = new Date()
  return db
    .select()
    .from(sdrSequenceSteps)
    .where(
      and(
        eq(sdrSequenceSteps.accountId, accountId),
        eq(sdrSequenceSteps.status, 'scheduled'),
        lte(sdrSequenceSteps.scheduledFor, now),
        isNull(sdrSequenceSteps.deletedAt),
      ),
    )
    .orderBy(sdrSequenceSteps.scheduledFor)
    .limit(limit)
}
