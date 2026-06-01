'use server'

import { markOnboardingComplete } from '@/lib/onboarding/account-store'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { revalidatePath } from 'next/cache'

/** Marks onboarding complete for workspace owners on their first real action. */
export async function tryCompleteOnboardingForOwner(
  accountId: string,
  role: string,
): Promise<boolean> {
  if (role !== 'owner') return false

  const alreadyComplete = await isOnboardingCompleteForAccount(accountId)
  if (alreadyComplete) return false

  const marked = await markOnboardingComplete(accountId)
  if (!marked.ok) return false

  revalidatePath('/admin', 'layout')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/clients')
  revalidatePath('/admin/pipeline')

  return true
}
