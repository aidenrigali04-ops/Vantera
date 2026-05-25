import { db } from '@/lib/db/client'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

/** Source of truth for onboarding completion — use when middleware headers are unknown. */
export async function isOnboardingCompleteForAccount(accountId: string): Promise<boolean> {
  const [row] = await db
    .select({ onboardingCompletedAt: accounts.onboardingCompletedAt })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  return Boolean(row?.onboardingCompletedAt)
}
