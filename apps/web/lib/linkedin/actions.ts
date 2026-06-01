'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { linkedinCampaigns, linkedinSequences } from '@vantera/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function createCampaign(name: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminSession()

  const [campaign] = await db
    .insert(linkedinCampaigns)
    .values({
      accountId: session.accountId,
      name,
      ownerId: session.userId,
      status: 'paused',
    })
    .returning()

  revalidatePath('/admin/outreach/linkedin')
  return { success: true, data: { id: campaign!.id } }
}

export async function enrollLeads(
  campaignId: string,
  leadIds: string[],
): Promise<ActionResult<{ enrolled: number }>> {
  const session = await requireAdminSession()
  if (leadIds.length === 0) return { success: false, error: 'No leads selected' }

  const rows = await db
    .insert(linkedinSequences)
    .values(
      leadIds.map((leadId) => ({
        accountId: session.accountId,
        campaignId,
        leadId,
        status: 'active' as const,
      })),
    )
    .returning()

  revalidatePath('/admin/outreach/linkedin')
  revalidatePath('/admin/pipeline')
  return { success: true, data: { enrolled: rows.length } }
}

export async function pauseCampaign(campaignId: string): Promise<ActionResult> {
  const session = await requireAdminSession()

  await db
    .update(linkedinCampaigns)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(linkedinCampaigns.id, campaignId))

  revalidatePath('/admin/outreach/linkedin')
  return { success: true, data: undefined }
}
