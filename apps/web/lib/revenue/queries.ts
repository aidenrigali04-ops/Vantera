import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { getLeadPipelineStats } from '@/lib/leads/queries'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'

/**
 * MRR progress toward the account's goal. "Current MRR" is derived from won
 * leads × the configured average client value — so it grows as the SDR agent
 * converts the pipeline. Goal/avg are set in onboarding or on the dashboard.
 */
export async function getRevenueProgress(accountId: string): Promise<RevenueProgress> {
  const [acct] = await db
    .select({ mrrGoal: accounts.mrrGoal, avgClientValue: accounts.avgClientValue })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const goal = acct?.mrrGoal ?? null
  const avgValue = acct?.avgClientValue ?? null

  const stats = await getLeadPipelineStats(accountId)
  const wonCount = stats.byStatus.find((row) => row.status === 'won')?.count ?? 0

  const currentMrr = avgValue ? wonCount * avgValue : 0
  const pct = goal && goal > 0 ? Math.min(100, Math.round((currentMrr / goal) * 100)) : 0

  return { goal, avgValue, wonCount, currentMrr, pct }
}
