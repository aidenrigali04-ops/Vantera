'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { tryCompleteOnboardingForOwner } from '@/lib/onboarding/complete-on-first-action'
import { revalidatePath } from 'next/cache'

export async function recordOnboardingSuccessAction(): Promise<ActionResult<{ completed: true }>> {
  try {
    const session = await requireAdminSession()
    await tryCompleteOnboardingForOwner(session.accountId, session.role)
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin', 'layout')
    return { success: true, data: { completed: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete setup',
    }
  }
}
