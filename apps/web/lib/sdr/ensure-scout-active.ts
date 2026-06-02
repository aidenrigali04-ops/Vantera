import { db } from '@/lib/db/client'
import { findSdrConfigByAccount } from '@/lib/sdr/queries'
import { sdrAgentConfigs } from '@vantera/db'
import { eq } from 'drizzle-orm'

export class ProspectScoutNotConfiguredError extends Error {
  constructor() {
    super('Configure Prospect Scout before running discovery')
    this.name = 'ProspectScoutNotConfiguredError'
  }
}

/** Ensures the scout agent is active and unpaused before a manual or scheduled discovery run. */
export async function ensureProspectScoutActiveForDiscovery(accountId: string) {
  const config = await findSdrConfigByAccount(accountId)
  if (!config) {
    throw new ProspectScoutNotConfiguredError()
  }

  if (config.isActive && !config.isPaused) {
    return config
  }

  const [updated] = await db
    .update(sdrAgentConfigs)
    .set({
      isActive: true,
      isPaused: false,
      pausedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(sdrAgentConfigs.id, config.id))
    .returning()

  return updated ?? { ...config, isActive: true, isPaused: false, pausedReason: null }
}
