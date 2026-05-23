'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { clearSampleData } from '@/lib/sample-data/seed'
import { revalidatePath } from 'next/cache'

export async function clearSampleDataAction(): Promise<ActionResult<{ cleared: true }>> {
  try {
    const session = await requireAdminSession()
    if (session.role !== 'owner' && session.role !== 'admin') {
      return { success: false, error: 'Only owners or admins can clear sample data.' }
    }

    await clearSampleData(session.accountId)
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin', 'layout')

    return { success: true, data: { cleared: true } }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to clear sample data',
    }
  }
}
