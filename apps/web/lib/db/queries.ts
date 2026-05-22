import { db } from '@/lib/db/client'
import {
  accounts,
  automations,
  contactTypeEnum,
  contacts,
  records,
  stageDefinitions,
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
    search?: string
    tags?: string[]
    limit?: number
    offset?: number
  },
) {
  const conditions = [eq(contacts.accountId, accountId), isNull(contacts.deletedAt)]

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
