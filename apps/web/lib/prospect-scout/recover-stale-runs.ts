import { db } from '@/lib/db/client'
import { aspireSearchRuns } from '@vantera/db'
import { and, eq, lt } from 'drizzle-orm'

/** Mark long-running Apify jobs as failed so the UI is not stuck on "running". */
export async function recoverStaleAspireSearchRuns(
  accountId: string,
  maxAgeMinutes = 15,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

  const rows = await db
    .update(aspireSearchRuns)
    .set({
      status: 'failed',
      errorMessage: 'Run timed out or was interrupted',
      finishedAt: new Date(),
    })
    .where(
      and(
        eq(aspireSearchRuns.accountId, accountId),
        eq(aspireSearchRuns.status, 'running'),
        lt(aspireSearchRuns.runAt, cutoff),
      ),
    )
    .returning({ id: aspireSearchRuns.id })

  if (rows.length > 0) {
    console.warn('[recoverStaleAspireSearchRuns]', accountId, rows.length, 'stale runs cleared')
  }

  return rows.length
}
