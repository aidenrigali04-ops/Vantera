'use server'

import {
  bootstrapBusinessContext,
  dailyIntelligenceSweep,
} from '@/lib/ai'
import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'

// Manually re-run the bootstrap workflow. Useful after an Anthropic key is
// configured for the first time or after editing onboarding inputs.
export async function rerunBootstrap(): Promise<ActionResult<{ ranAt: string }>> {
  const session = await requireAdminSession()
  if (session.role !== 'owner') {
    return { success: false, error: 'Only the account owner can re-run the brain bootstrap.' }
  }

  const result = await bootstrapBusinessContext(session.accountId, session.userId)
  return { success: true, data: { ranAt: result.ranAt } }
}

// Manually trigger a daily intelligence sweep, mostly for development.
export async function runDailySweep(): Promise<ActionResult<{ ranAt: string }>> {
  const session = await requireAdminSession()
  if (session.role !== 'owner') {
    return { success: false, error: 'Only the account owner can run a sweep.' }
  }

  const result = await dailyIntelligenceSweep(session.accountId, session.userId)
  return { success: true, data: { ranAt: result.ranAt } }
}
