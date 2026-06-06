'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { findLeadById } from '@/lib/leads/queries'
import { activities, leads } from '@vantera/db'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

type CreateLeadInput = {
  firstName?: string
  lastName?: string
  title?: string
  company: string
  email?: string
  phone?: string
  linkedinUrl?: string
  source?: (typeof leads.source.enumValues)[number]
  relationshipStatus?: (typeof leads.relationshipStatus.enumValues)[number]
  ownerId?: string
  notes?: string
}

export async function createLead(input: CreateLeadInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminSession()

  const [lead] = await db
    .insert(leads)
    .values({
      accountId: session.accountId,
      firstName: input.firstName,
      lastName: input.lastName,
      title: input.title,
      company: input.company,
      email: input.email,
      phone: input.phone,
      linkedinUrl: input.linkedinUrl,
      source: input.source ?? 'manual',
      relationshipStatus: input.relationshipStatus ?? 'new',
      ownerId: input.ownerId ?? session.userId,
      notes: input.notes,
    })
    .returning()

  await db.insert(activities).values({
    accountId: session.accountId,
    leadId: lead!.id,
    actorType: 'user',
    actorId: session.userId,
    activityType: 'lead_created',
    body: 'Lead added to pipeline',
  })

  revalidatePath('/admin/crm/pipeline')
  revalidatePath('/admin/dashboard')
  return { success: true, data: { id: lead!.id } }
}

export async function updateLead(
  leadId: string,
  patch: Partial<
    CreateLeadInput & {
      relationshipStatus: (typeof leads.relationshipStatus.enumValues)[number]
      score: number
    }
  >,
): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findLeadById(session.accountId, leadId)
  if (!existing) return { success: false, error: 'Lead not found' }

  await db
    .update(leads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.accountId, session.accountId)))

  revalidatePath('/admin/crm/pipeline')
  revalidatePath(`/admin/crm/pipeline/${leadId}`)
  return { success: true, data: undefined }
}

export async function bulkUpdateLeads(
  leadIds: string[],
  patch: {
    relationshipStatus?: (typeof leads.relationshipStatus.enumValues)[number]
    ownerId?: string
  },
): Promise<ActionResult<{ updated: number }>> {
  const session = await requireAdminSession()
  if (leadIds.length === 0) return { success: false, error: 'No leads selected' }

  const result = await db
    .update(leads)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(leads.accountId, session.accountId),
        inArray(leads.id, leadIds),
        isNull(leads.deletedAt),
      ),
    )
    .returning({ id: leads.id })

  revalidatePath('/admin/crm/pipeline')
  return { success: true, data: { updated: result.length } }
}
