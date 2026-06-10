import { db } from '@/lib/db/client'
import { activities, leadProfiles, leads } from '@vantera/db'
import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm'

export type LeadFilters = {
  search?: string
  source?: string
  relationshipStatus?: string
  ownerId?: string
  minScore?: number
  ids?: string[]
  limit?: number
  offset?: number
}

function buildLeadConditions(accountId: string, filters: LeadFilters) {
  const conditions = [eq(leads.accountId, accountId), isNull(leads.deletedAt)]

  if (filters.source) {
    conditions.push(eq(leads.source, filters.source as typeof leads.source.enumValues[number]))
  }
  if (filters.relationshipStatus) {
    conditions.push(
      eq(leads.relationshipStatus, filters.relationshipStatus as typeof leads.relationshipStatus.enumValues[number]),
    )
  }
  if (filters.ownerId) {
    conditions.push(eq(leads.ownerId, filters.ownerId))
  }
  if (filters.minScore !== undefined) {
    conditions.push(sql`${leads.score} >= ${filters.minScore}`)
  }
  if (filters.search) {
    const q = `%${filters.search}%`
    conditions.push(
      or(
        ilike(leads.firstName, q),
        ilike(leads.lastName, q),
        ilike(leads.company, q),
        ilike(leads.email, q),
      )!,
    )
  }
  if (filters.ids && filters.ids.length > 0) {
    conditions.push(inArray(leads.id, filters.ids))
  }

  return conditions
}

export async function findLeads(accountId: string, filters: LeadFilters = {}) {
  const conditions = buildLeadConditions(accountId, filters)
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  return db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)
}

/** Leads joined with their AI profile rows — feeds the enriched pipeline table. */
export async function findLeadsWithProfiles(accountId: string, filters: LeadFilters = {}) {
  const conditions = buildLeadConditions(accountId, filters)
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  return db
    .select({ lead: leads, profile: leadProfiles })
    .from(leads)
    .leftJoin(leadProfiles, eq(leadProfiles.leadId, leads.id))
    .where(and(...conditions))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function countLeads(accountId: string, filters: Omit<LeadFilters, 'limit' | 'offset'> = {}) {
  const rows = await findLeads(accountId, { ...filters, limit: 10000 })
  return rows.length
}

export async function findLeadById(accountId: string, leadId: string) {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)
  return lead ?? null
}

export async function findLeadWithProfile(accountId: string, leadId: string) {
  const [row] = await db
    .select({ lead: leads, profile: leadProfiles })
    .from(leads)
    .leftJoin(leadProfiles, eq(leadProfiles.leadId, leads.id))
    .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId), isNull(leads.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function findLeadActivities(accountId: string, leadId: string, limit = 50) {
  return db
    .select()
    .from(activities)
    .where(and(eq(activities.accountId, accountId), eq(activities.leadId, leadId)))
    .orderBy(desc(activities.createdAt))
    .limit(limit)
}

export async function getLeadPipelineStats(accountId: string) {
  const rows = await db
    .select({
      status: leads.relationshipStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(leads)
    .where(and(eq(leads.accountId, accountId), isNull(leads.deletedAt)))
    .groupBy(leads.relationshipStatus)

  const total = rows.reduce((s, r) => s + r.count, 0)
  const qualified = rows.find((r) => r.status === 'qualified')?.count ?? 0

  return { total, qualified, byStatus: rows }
}

/** Slim creation timeline for the current year — feeds the dashboard revenue trend. */
export async function getLeadCreationTimeline(accountId: string) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  return db
    .select({ createdAt: leads.createdAt, relationshipStatus: leads.relationshipStatus })
    .from(leads)
    .where(
      and(
        eq(leads.accountId, accountId),
        isNull(leads.deletedAt),
        gte(leads.createdAt, yearStart),
      ),
    )
}
