'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { tryCompleteOnboardingForOwner } from '@/lib/onboarding/complete-on-first-action'
import { clearSampleData } from '@/lib/sample-data/seed'
import { revalidatePath } from 'next/cache'

/** User chose to keep sample data and finish first-session onboarding. */
export async function keepSampleDataAction(): Promise<ActionResult<{ completed: true }>> {
  try {
    const session = await requireAdminSession()
    if (session.role !== 'owner') {
      return { success: false, error: 'Only the workspace owner can complete setup.' }
    }

    const completed = await tryCompleteOnboardingForOwner(session.accountId, session.role)
    if (!completed) {
      return { success: false, error: 'Setup could not be completed. Try again.' }
    }

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

/** First real workspace action — marks onboarding success (Step 6). */
export async function recordOnboardingSuccessAction(): Promise<ActionResult<{ completed: true }>> {
  try {
    const session = await requireAdminSession()
    await tryCompleteOnboardingForOwner(session.accountId, session.role)

    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/clients')
    revalidatePath('/admin', 'layout')

    return { success: true, data: { completed: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete setup',
    }
  }
}

/** @deprecated Use recordOnboardingSuccessAction */
export const recordFirstClientAction = recordOnboardingSuccessAction

/** Clean slate: wipe demo content. Onboarding completes on first real action. */
export async function clearSampleDataAction(): Promise<ActionResult<{ cleared: true }>> {
  try {
    const session = await requireAdminSession()
    if (session.role !== 'owner' && session.role !== 'admin') {
      return { success: false, error: 'Only owners or admins can clear sample data.' }
    }

    await clearSampleData(session.accountId)

    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/clients')
    revalidatePath('/admin', 'layout')

    return { success: true, data: { cleared: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear sample data',
    }
  }
}
