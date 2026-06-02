import { runAccountProspectScout } from '@/lib/prospect-scout/run-account'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import type { RunAccountResult } from '@/lib/prospect-scout/types'

/**
 * First-run / post-setup discovery: Apify → ICP filter → pipeline leads (+ optional SDR sequence).
 * Separate from the manual Aspire discovery UI.
 */
export async function runProspectScoutBootstrap(
  accountId: string,
): Promise<RunAccountResult | null> {
  const config = await findSdrConfigByAccount(accountId)
  if (!config || !config.isActive || config.isPaused) {
    return null
  }

  return runAccountProspectScout(accountId)
}
