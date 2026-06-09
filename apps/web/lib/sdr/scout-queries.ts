import { db } from '@/lib/db/client'
import {
  aspireSavedSearches,
  aspireResults,
  leads,
  leadProfiles,
} from '@vantera/db'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

export async function listScoutRuns(accountId: string, limit = 10) {
  const searches = await db
    .select({
      id: aspireSavedSearches.id,
      name: aspireSavedSearches.name,
      runFrequency: aspireSavedSearches.runFrequency,
      lastRunAt: aspireSavedSearches.lastRunAt,
      totalFound: aspireSavedSearches.totalFound,
      isActive: aspireSavedSearches.isActive,
      createdAt: aspireSavedSearches.createdAt,
    })
    .from(aspireSavedSearches)
    .where(
      and(
        eq(aspireSavedSearches.accountId, accountId),
        isNull(aspireSavedSearches.deletedAt),
      ),
    )
    .orderBy(desc(aspireSavedSearches.lastRunAt))
    .limit(limit)

  if (searches.length === 0) return []

  const ids = searches.map((s) => s.id)
  const counts = await db
    .select({
      searchId: aspireResults.searchId,
      total: sql<number>`count(*)::int`,
      enrolled: sql<number>`count(*) filter (where ${aspireResults.enrolledAt} is not null)::int`,
    })
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
        inArray(aspireResults.searchId, ids),
      ),
    )
    .groupBy(aspireResults.searchId)

  const countMap = new Map(counts.map((c) => [c.searchId, c]))

  return searches.map((s) => ({
    ...s,
    resultCount: countMap.get(s.id)?.total ?? s.totalFound,
    enrolledCount: countMap.get(s.id)?.enrolled ?? 0,
  }))
}

export async function getScoutRunResults(accountId: string, searchId: string, limit = 100) {
  const [search] = await db
    .select()
    .from(aspireSavedSearches)
    .where(
      and(
        eq(aspireSavedSearches.id, searchId),
        eq(aspireSavedSearches.accountId, accountId),
        isNull(aspireSavedSearches.deletedAt),
      ),
    )
    .limit(1)

  if (!search) return null

  const results = await db
    .select({
      result: aspireResults,
      firstName: leads.firstName,
      lastName: leads.lastName,
      title: leads.title,
      company: leads.company,
      email: leads.email,
      linkedinUrl: leads.linkedinUrl,
      score: leads.score,
      relationshipStatus: leads.relationshipStatus,
    })
    .from(aspireResults)
    .leftJoin(leads, eq(aspireResults.leadId, leads.id))
    .where(
      and(
        eq(aspireResults.searchId, searchId),
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
      ),
    )
    .orderBy(desc(aspireResults.icpScore), desc(aspireResults.createdAt))
    .limit(limit)

  return { search, results }
}

export async function getScoutResultDetail(accountId: string, resultId: string) {
  const [row] = await db
    .select()
    .from(aspireResults)
    .where(
      and(
        eq(aspireResults.id, resultId),
        eq(aspireResults.accountId, accountId),
        isNull(aspireResults.deletedAt),
      ),
    )
    .limit(1)

  if (!row) return null

  const [lead] = row.leadId
    ? await db.select().from(leads).where(eq(leads.id, row.leadId)).limit(1)
    : []

  const [profile] = lead
    ? await db.select().from(leadProfiles).where(eq(leadProfiles.leadId, lead.id)).limit(1)
    : []

  return {
    result: row,
    lead: lead ?? null,
    profile: profile ?? null,
  }
}
