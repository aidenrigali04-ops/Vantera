import { recoverStaleAspireSearchRuns } from '@/lib/prospect-scout/recover-stale-runs'
import { runAccountProspectScout } from '@/lib/prospect-scout/run-account'
import { db } from '@/lib/db/client'
import { ensureProspectScoutActiveForDiscovery } from '@/lib/sdr/ensure-scout-active'
import { logSdrActivity } from '@/lib/sdr/activity-log'
import { requireSDREnabledForAccount } from '@/lib/sdr/guard'
import type { Plan } from '@/lib/feature-flags/flags'
import type { RunAccountResult } from '@/lib/prospect-scout/types'
import { accounts } from '@vantera/db'
import { eq } from 'drizzle-orm'

/**
 * First-run / post-setup discovery: Apify → ICP filter → pipeline leads (+ optional SDR sequence).
 * Separate from the manual Aspire discovery UI.
 */
export async function runProspectScoutBootstrap(
  accountId: string,
): Promise<RunAccountResult | null> {
  const [account] = await db
    .select({ plan: accounts.plan })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1)

  const plan = (account?.plan ?? 'team') as Plan
  await requireSDREnabledForAccount(accountId, plan)

  await recoverStaleAspireSearchRuns(accountId)

  const config = await ensureProspectScoutActiveForDiscovery(accountId)

  await logSdrActivity({
    accountId,
    configId: config.id,
    eventType: 'discovery_started',
    metadata: { source: 'bootstrap' },
  })

  try {
    const result = await runAccountProspectScout(accountId)

    await logSdrActivity({
      accountId,
      configId: config.id,
      eventType: 'discovery_completed',
      metadata: {
        found: result.found,
        enrolled: result.enrolled,
        searchesRun: result.searchesRun,
      },
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Discovery failed'
    await logSdrActivity({
      accountId,
      configId: config.id,
      eventType: 'discovery_failed',
      metadata: { source: 'bootstrap', error: message },
    })
    throw error
  }
}
