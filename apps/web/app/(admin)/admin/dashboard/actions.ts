'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { markOnboardingComplete } from '@/lib/onboarding/account-store'
import { clearSampleData } from '@/lib/sample-data/seed'
import { revalidatePath } from 'next/cache'

/** User chose to keep sample data and finish first-session onboarding. */
export async function keepSampleDataAction(): Promise<ActionResult<{ completed: true }>> {
  try {
    const session = await requireAdminSession()
    if (session.role !== 'owner') {
      return { success: false, error: 'Only the workspace owner can complete setup.' }
    }

    const marked = await markOnboardingComplete(session.accountId)
    if (!marked.ok) {
      return { success: false, error: marked.message }
    }

    revalidatePath('/admin', 'layout')
    revalidatePath('/admin/dashboard')

    return { success: true, data: { completed: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete setup',
    }
  }
}

/** Clean slate: wipe demo content and mark onboarding complete. */
export async function clearSampleDataAction(): Promise<ActionResult<{ cleared: true }>> {
  try {
    const session = await requireAdminSession()
    if (session.role !== 'owner' && session.role !== 'admin') {
      return { success: false, error: 'Only owners or admins can clear sample data.' }
    }

    await clearSampleData(session.accountId)

    if (session.role === 'owner') {
      const marked = await markOnboardingComplete(session.accountId)
      if (!marked.ok) {
        return { success: false, error: marked.message }
      }
    }

    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/crm/clients')
    revalidatePath('/admin', 'layout')

    return { success: true, data: { cleared: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear sample data',
    }
  }
}
