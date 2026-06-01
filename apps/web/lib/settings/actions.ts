'use server'

import { updateBranding as updateBrandingAction } from '@/app/(admin)/admin/onboarding/actions'
import type { ActionResult } from '@/lib/auth/types'
import { getAdminSession } from '@/lib/auth/session'
import { ROLE_RANK } from '@/lib/auth/constants'
import { patchAccountRow } from '@/lib/onboarding/account-store'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters').max(120),
  timezone: z.string().max(64).optional().nullable(),
})

function err(message: string): ActionResult<never> {
  return { success: false, error: message }
}

async function assertSettingsAccess(): Promise<{ accountId: string; role: string }> {
  const session = await getAdminSession()
  if (!session) {
    return Promise.reject(new Error('Your session expired. Refresh and sign in again.'))
  }

  const rank = ROLE_RANK[session.role] ?? 0
  if (rank < ROLE_RANK.admin) {
    return Promise.reject(new Error('You do not have permission to change workspace settings.'))
  }

  return { accountId: session.accountId, role: session.role }
}

export async function updateWorkspaceGeneral(input: {
  name: string
  timezone?: string | null
}): Promise<ActionResult<{ saved: true }>> {
  try {
    const { accountId } = await assertSettingsAccess()
    const parsed = workspaceSchema.safeParse(input)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? 'Invalid workspace settings')
    }

    const saved = await patchAccountRow(accountId, {
      name: parsed.data.name.trim(),
      timezone: parsed.data.timezone?.trim() || null,
    })

    if (!saved.ok) {
      return err(saved.message)
    }

    revalidatePath('/admin/settings')
    revalidatePath('/admin/dashboard')

    return { success: true, data: { saved: true } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to save workspace settings')
  }
}

export async function updateWorkspaceBranding(input: {
  logoUrl?: string | null
  primaryColor: string
  secondaryColor: string
  portalDomain?: string
}): Promise<ActionResult<{ saved: true }>> {
  try {
    await assertSettingsAccess()
    const result = await updateBrandingAction('', input)
    if (!result.success) return result

    revalidatePath('/admin/settings')
    revalidatePath('/admin/portal')

    return { success: true, data: { saved: true } }
  } catch (error) {
    return err(error instanceof Error ? error.message : 'Failed to save branding')
  }
}

export { inviteTeamMembers } from '@/app/(admin)/admin/onboarding/actions'
export { saveOperatingModel } from '@/lib/onboarding/save-operating-model'
