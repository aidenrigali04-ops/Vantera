import { getAdminSession } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { evaluateFlag } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

export class SdrNotEnabledError extends Error {
  constructor(message = 'SDR Agent is not enabled for this account') {
    super(message)
    this.name = 'SdrNotEnabledError'
  }
}

export async function requireSDREnabled(): Promise<{
  accountId: string
  userId: string
  plan: Plan
}> {
  const session = await getAdminSession()
  if (!session) {
    throw new SdrNotEnabledError('Unauthorized')
  }

  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, session.accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  const enabled = await evaluateFlag({
    accountId: session.accountId,
    plan,
    flagName: 'sdr_agent_enabled',
  })

  if (!enabled) {
    throw new SdrNotEnabledError()
  }

  return { accountId: session.accountId, userId: session.userId, plan }
}

export async function isSdrEnabledForAccount(accountId: string, plan: Plan): Promise<boolean> {
  return evaluateFlag({ accountId, plan, flagName: 'sdr_agent_enabled' })
}

export async function requireSDREnabledForAccount(
  accountId: string,
  plan: Plan,
): Promise<void> {
  const enabled = await isSdrEnabledForAccount(accountId, plan)
  if (!enabled) {
    throw new SdrNotEnabledError()
  }
}
