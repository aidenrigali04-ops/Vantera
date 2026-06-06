'use server'

import { requireAdminSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'

/** @deprecated Onboarding must be completed through the setup wizard. */
export async function recordOnboardingSuccessAction(): Promise<ActionResult<{ completed: true }>> {
  void (await requireAdminSession())
  return {
    success: false,
    error: 'Complete all setup steps in the onboarding wizard before accessing the platform.',
  }
}
