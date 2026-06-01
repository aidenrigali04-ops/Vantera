import { db } from '@/lib/db/client'
import {
  accounts,
  activities,
  automations,
  contactTypeEnum,
  contacts,
  intelligenceSignals,
  records,
  stageDefinitions,
  users,
} from '@vantera/db'
import { and, asc, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm'

export async function getAccount(accountId: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return account ?? null
}

export async function findRecords(
  accountId: string,
  filters?: {
    stageId?: string
    recordType?: string
    assignedUserId?: string
    contactId?: string
    isPipeline?: boolean
    limit?: number
    offset?: number
  },
) {
  const conditions = [eq(records.accountId, accountId), isNull(records.deletedAt)]

  if (filters?.stageId) {
    conditions.push(eq(records.stageId, filters.stageId))
  }

  if (filters?.recordType) {
    conditions.push(eq(records.recordType, filters.recordType))
  }

  if (filters?.assignedUserId) {
    conditions.push(eq(records.assignedUserId, filters.assignedUserId))
  }

  if (filters?.contactId) {
    conditions.push(eq(records.contactId, filters.contactId))
  }

  if (filters?.isPipeline !== undefined) {
    conditions.push(eq(records.isPipeline, filters.isPipeline))
  }

  const limit = filters?.limit ?? 50
  const offset = filters?.offset ?? 0

  return db
    .select()
    .from(records)
    .where(and(...conditions))
    .orderBy(desc(records.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function findContacts(
  accountId: string,
  filters?: {
    type?: string
    lifecycleStage?: 'prospect' | 'active_client' | 'churned'
    search?: string
    tags?: string[]
    limit?: number
    offset?: number
  },
) {
  const conditions = [eq(contacts.accountId, accountId), isNull(contacts.deletedAt)]

  if (filters?.lifecycleStage) {
    conditions.push(eq(contacts.lifecycleStage, filters.lifecycleStage))
  }

  if (filters?.type) {
    conditions.push(
      eq(contacts.type, filters.type as (typeof contactTypeEnum.enumValues)[number]),
    )
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`
    conditions.push(
      or(
        ilike(contacts.firstName, pattern),
        ilike(contacts.lastName, pattern),
        ilike(contacts.email, pattern),
        ilike(contacts.phone, pattern),
      )!,
    )
  }

  if (filters?.tags?.length) {
    conditions.push(sql`${contacts.tags} @> ${filters.tags}`)
  }

  const limit = filters?.limit ?? 50
  const offset = filters?.offset ?? 0

  return db
    .select()
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function findRecord(accountId: string, recordId: string) {
  const [record] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.id, recordId),
        eq(records.accountId, accountId),
        isNull(records.deletedAt),
      ),
    )
    .limit(1)

  return record ?? null
}

export async function findContact(accountId: string, contactId: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        eq(contacts.id, contactId),
        eq(contacts.accountId, accountId),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  return contact ?? null
}

export async function getStageDefinitions(accountId: string, recordType: string) {
  return db
    .select()
    .from(stageDefinitions)
    .where(
      and(eq(stageDefinitions.accountId, accountId), eq(stageDefinitions.recordType, recordType)),
    )
    .orderBy(asc(stageDefinitions.position))
}

export async function getActiveAutomations(accountId: string, triggerEvent: string) {
  return db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.accountId, accountId),
        eq(automations.isActive, true),
        eq(automations.triggerEvent, triggerEvent),
        isNull(automations.deletedAt),
      ),
    )
}

export async function countContactsByType(accountId: string) {
  const rows = await db
    .select({
      type: contacts.type,
      count: sql<number>`count(*)::int`,
    })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), isNull(contacts.deletedAt)))
    .groupBy(contacts.type)

  return Object.fromEntries(rows.map((row) => [row.type, row.count])) as Record<string, number>
}

export async function getActiveClientKpis(accountId: string) {
  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.lifecycleStage, 'active_client'),
        isNull(contacts.deletedAt),
      ),
    )

  const [atRiskRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(
      and(
        eq(contacts.accountId, accountId),
        eq(contacts.lifecycleStage, 'active_client'),
        isNull(contacts.deletedAt),
        sql`${contacts.churnRiskScore} > 70`,
      ),
    )

  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        isNull(records.deletedAt),
        isNull(records.completedAt),
        sql`${records.scheduledAt} < now()`,
      ),
    )

  return {
    activeClients: activeRow?.count ?? 0,
    churnRisk: atRiskRow?.count ?? 0,
    overdueTasks: overdueRow?.count ?? 0,
    renewalsDue: 0,
  }
}

export async function findUnifiedContactActivities(
  accountId: string,
  contactId: string,
  leadId?: string | null,
  limit = 50,
) {
  const contactActivities = await findContactActivities(accountId, contactId, limit)

  if (!leadId) {
    return contactActivities
  }

  const leadActivities = await db
    .select()
    .from(activities)
    .where(and(eq(activities.accountId, accountId), eq(activities.leadId, leadId)))
    .orderBy(desc(activities.createdAt))
    .limit(limit)

  return [...contactActivities, ...leadActivities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

export async function findContactActivities(accountId: string, contactId: string, limit = 20) {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.accountId, accountId), eq(activities.contactId, contactId)))
    .orderBy(desc(activities.createdAt))
    .limit(limit)
}

export async function countOpenRecordsForContact(accountId: string, contactId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        eq(records.contactId, contactId),
        isNull(records.deletedAt),
        isNull(records.completedAt),
      ),
    )

  return row?.count ?? 0
}

export async function findRecordsForContact(accountId: string, contactId: string, limit = 10) {
  return db
    .select()
    .from(records)
    .where(
      and(
        eq(records.accountId, accountId),
        eq(records.contactId, contactId),
        isNull(records.deletedAt),
      ),
    )
    .orderBy(desc(records.createdAt))
    .limit(limit)
}

export async function findSignalsForContact(accountId: string, contactId: string, limit = 5) {
  return db
    .select()
    .from(intelligenceSignals)
    .where(
      and(
        eq(intelligenceSignals.accountId, accountId),
        eq(intelligenceSignals.contactId, contactId),
        eq(intelligenceSignals.isDismissed, false),
      ),
    )
    .orderBy(desc(intelligenceSignals.createdAt))
    .limit(limit)
}

export async function findRecordsWithRelations(
  accountId: string,
  filters?: Parameters<typeof findRecords>[1],
) {
  const rows = await findRecords(accountId, filters)

  return Promise.all(
    rows.map(async (record) => {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(eq(contacts.id, record.contactId))
        .limit(1)
      const [stage] = await db
        .select()
        .from(stageDefinitions)
        .where(eq(stageDefinitions.id, record.stageId))
        .limit(1)

      return { ...record, contact: contact ?? null, stage: stage ?? null }
    }),
  )
}

export async function findRecordWithRelations(accountId: string, recordId: string) {
  const record = await findRecord(accountId, recordId)
  if (!record) return null

  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, record.contactId))
    .limit(1)
  const [stage] = await db
    .select()
    .from(stageDefinitions)
    .where(eq(stageDefinitions.id, record.stageId))
    .limit(1)

  const recordActivities = await db
    .select()
    .from(activities)
    .where(and(eq(activities.accountId, accountId), eq(activities.recordId, recordId)))
    .orderBy(desc(activities.createdAt))
    .limit(50)

  return {
    ...record,
    contact: contact ?? null,
    stage: stage ?? null,
    activities: recordActivities,
  }
}

export async function getProjectKpis(accountId: string, recordType = 'project') {
  const base = and(
    eq(records.accountId, accountId),
    isNull(records.deletedAt),
    eq(records.recordType, recordType),
  )

  const [activeRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(and(base, isNull(records.completedAt)))

  const [overdueRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(
      and(base, isNull(records.completedAt), sql`${records.scheduledAt} < now()`),
    )

  const [completedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(records)
    .where(and(base, sql`${records.completedAt} is not null`))

  const [valueRow] = await db
    .select({ total: sql<number>`coalesce(sum(${records.valueCents}), 0)::bigint` })
    .from(records)
    .where(and(base, isNull(records.completedAt)))

  return {
    active: activeRow?.count ?? 0,
    overdue: overdueRow?.count ?? 0,
    completed: completedRow?.count ?? 0,
    activeValueCents: Number(valueRow?.total ?? 0),
  }
}

export async function findUsersForAccount(accountId: string) {
  return db
    .select()
    .from(users)
    .where(and(eq(users.accountId, accountId), isNull(users.deletedAt), eq(users.isActive, true)))
    .orderBy(asc(users.fullName))
}
