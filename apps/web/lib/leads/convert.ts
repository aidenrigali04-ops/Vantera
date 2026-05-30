'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { findLeadById } from '@/lib/leads/queries'
import { activities, contacts, leads, records, stageDefinitions } from '@vantera/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export async function convertLeadToClient(leadId: string): Promise<ActionResult<{ contactId: string }>> {
  const session = await requireAdminSession()
  const lead = await findLeadById(session.accountId, leadId)

  if (!lead) {
    return { success: false, error: 'Lead not found' }
  }

  if (lead.convertedContactId) {
    return { success: true, data: { contactId: lead.convertedContactId } }
  }

  const [firstStage] = await db
    .select()
    .from(stageDefinitions)
    .where(and(eq(stageDefinitions.accountId, session.accountId), eq(stageDefinitions.recordType, 'lead')))
    .orderBy(asc(stageDefinitions.position))
    .limit(1)

  const result = await db.transaction(async (tx) => {
    const [contact] = await tx
      .insert(contacts)
      .values({
        accountId: session.accountId,
        type: 'customer',
        firstName: lead.firstName ?? 'Unknown',
        lastName: lead.lastName ?? '',
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        jobTitle: lead.title,
        linkedinUrl: lead.linkedinUrl,
        lifecycleStage: 'active_client',
        convertedFromLeadId: lead.id,
        source: lead.source,
        tags: lead.tags,
        notes: lead.notes,
      })
      .returning()

    await tx
      .update(leads)
      .set({
        convertedContactId: contact!.id,
        relationshipStatus: 'won',
        updatedAt: new Date(),
      })
      .where(eq(leads.id, lead.id))

    if (firstStage) {
      await tx.insert(records).values({
        accountId: session.accountId,
        contactId: contact!.id,
        recordType: 'lead',
        title: `${lead.company} — onboarding`,
        stageId: firstStage.id,
        assignedUserId: lead.ownerId ?? session.userId,
        isPipeline: true,
        source: lead.source,
      })
    }

    await tx.insert(activities).values({
      accountId: session.accountId,
      contactId: contact!.id,
      leadId: lead.id,
      actorType: 'user',
      actorId: session.userId,
      activityType: 'lead_converted',
      body: `Converted lead to active client`,
    })

    return contact!
  })

  revalidatePath('/admin/crm/clients')
  revalidatePath('/admin/crm/pipeline')

  return { success: true, data: { contactId: result.id } }
}
