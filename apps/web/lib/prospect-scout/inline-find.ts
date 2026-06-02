import { runProspectScoutDiscovery } from '@/lib/prospect-scout/discover'
import type { SdrConfigRow } from '@/lib/prospect-scout/types'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Prospect Scout discovery → aspire_results → optional SDR enroll. */
export async function runInlineProspectFind(config: SdrConfigRow): Promise<{
  found: number
  enrolled: number
}> {
  const result = await runProspectScoutDiscovery(config, { autoEnroll: true })
  return { found: result.found, enrolled: result.enrolled }
}

export async function runInlineProspectFindBatch(
  configs: SdrConfigRow[],
): Promise<{ accountsRun: number; leadsEnrolled: number }> {
  let accountsRun = 0
  let leadsEnrolled = 0

  for (const config of configs) {
    try {
      const { enrolled, found } = await runInlineProspectFind(config)
      if (enrolled > 0 || found > 0) accountsRun += 1
      leadsEnrolled += enrolled
    } catch (error) {
      console.error('[prospect-scout:inline] account failed:', config.accountId, error)
    }
    await sleep(300)
  }

  return { accountsRun, leadsEnrolled }
}
