import { db } from '@/lib/db/client'
import {
  aspireResults,
  aspireSavedSearches,
  aspireSearchRuns,
  leadDrafts,
  leadProfiles,
  leads,
} from '@vantera/db'
import { and, desc, eq, isNull } from 'drizzle-orm'

export type AspireResultWithContext = {
  result: typeof aspireResults.$inferSelect
  lead: typeof leads.$inferSelect | null
  profile: typeof leadProfiles.$inferSelect | null
}

const aspireResultWithContextSelect = {
  result: aspireResults,
  lead: leads,
  profile: leadProfiles,
} as const

export async function findSavedSearches(accountId: string) {
  return db
    .select()
    .from(aspireSavedSearches)
    .where(
      and(eq(aspireSavedSearches.accountId, accountId), isNull(aspireSavedSearches.deletedAt)),
    )
    .orderBy(desc(aspireSavedSearches.updatedAt))
}

export async function findRecentSearchRuns(accountId: string, limit = 10) {
  return db
    .select()
    .from(aspireSearchRuns)
    .where(eq(aspireSearchRuns.accountId, accountId))
    .orderBy(desc(aspireSearchRuns.runAt))
    .limit(limit)
}

/** Recent Aspire discoveries for the default (non–saved-search) table view. */
export async function findProspectScoutResults(
  accountId: string,
  limit = 50,
  offset = 0,
): Promise<AspireResultWithContext[]> {
  return db
    .select(aspireResultWithContextSelect)
    .from(aspireResults)
    .leftJoin(
      leads,
      and(eq(aspireResults.leadId, leads.id), isNull(leads.deletedAt)),
    )
    .leftJoin(leadProfiles, eq(leadProfiles.leadId, leads.id))
    .where(and(eq(aspireResults.accountId, accountId), isNull(aspireResults.deletedAt)))
    .orderBy(desc(aspireResults.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function findAspireResults(
  accountId: string,
  searchId: string,
  limit = 50,
  offset = 0,
): Promise<AspireResultWithContext[]> {
  return db
    .select(aspireResultWithContextSelect)
    .from(aspireResults)
    .leftJoin(
      leads,
      and(eq(aspireResults.leadId, leads.id), isNull(leads.deletedAt)),
    )
    .leftJoin(leadProfiles, eq(leadProfiles.leadId, leads.id))
    .where(
      and(
        eq(aspireResults.accountId, accountId),
        eq(aspireResults.searchId, searchId),
        isNull(aspireResults.deletedAt),
      ),
    )
    .orderBy(desc(aspireResults.icpScore))
    .limit(limit)
    .offset(offset)
}

export async function findPendingDrafts(accountId: string, limit = 20) {
  return db
    .select({
      draft: leadDrafts,
      lead: leads,
    })
    .from(leadDrafts)
    .innerJoin(leads, eq(leadDrafts.leadId, leads.id))
    .where(
      and(
        eq(leadDrafts.accountId, accountId),
        eq(leadDrafts.status, 'pending_review'),
        isNull(leadDrafts.deletedAt),
      ),
    )
    .orderBy(desc(leadDrafts.createdAt))
    .limit(limit)
}
