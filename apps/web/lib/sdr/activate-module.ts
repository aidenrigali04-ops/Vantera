'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { invalidateFlagCache } from '@/lib/feature-flags/evaluate'
import { featureFlags } from '@vantera/db'
import { revalidatePath } from 'next/cache'

export async function activateSdrModuleForAccount(accountId: string): Promise<ActionResult<{ enabled: true }>> {
  await db
    .insert(featureFlags)
    .values({
      accountId,
      flagName: 'sdr_agent_enabled',
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: [featureFlags.accountId, featureFlags.flagName],
      set: {
        isEnabled: true,
        updatedAt: new Date(),
      },
    })

  invalidateFlagCache(accountId)
  revalidatePath('/admin/outreach/agents')
  revalidatePath('/admin/outreach/agents/outreach')
  revalidatePath('/admin/outreach/agents/outreach/setup')

  return { success: true, data: { enabled: true } }
}

/** Owner-only self-serve activation before the setup wizard runs. */
export async function activateSdrModule(): Promise<ActionResult<{ enabled: true }>> {
  const session = await requireAdminSession()
  if (!session) {
    return { success: false, error: 'Unauthorized' }
  }
  if (session.role !== 'owner') {
    return { success: false, error: 'Only account owners can activate SDR Agents' }
  }

  return activateSdrModuleForAccount(session.accountId)
}
