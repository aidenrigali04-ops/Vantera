import { db } from '@/lib/db/client'
import { aspireSavedSearches, aspireSearchRuns } from '@vantera/db'
import { desc, eq } from 'drizzle-orm'

export async function findSavedSearches(accountId: string) {
  return db
    .select()
    .from(aspireSavedSearches)
    .where(eq(aspireSavedSearches.accountId, accountId))
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
