'use server'

import { requirePortalSession } from '@/lib/auth/require-session'
import type { ActionResult } from '@/lib/auth/types'
import { db } from '@/lib/db/client'
import { activities, contacts, messages } from '@vantera/db'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4000, 'Message is too long'),
  subject: z.string().trim().max(200).optional(),
})

export async function sendPortalMessage(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requirePortalSession()
  const parsed = sendMessageSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid message' }
  }

  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.id, session.contactId),
        eq(contacts.accountId, session.accountId),
        eq(contacts.portalAccess, true),
        isNull(contacts.deletedAt),
      ),
    )
    .limit(1)

  if (!contact) {
    return { success: false, error: 'Portal access is not available' }
  }

  const now = new Date()
  const preview = parsed.data.body.slice(0, 120)

  const [row] = await db
    .insert(messages)
    .values({
      accountId: session.accountId,
      contactId: session.contactId,
      direction: 'inbound',
      channel: 'portal',
      subject: parsed.data.subject ?? null,
      body: parsed.data.body,
      status: 'sent',
      sentAt: now,
      metadata: { source: 'client_portal' },
    })
    .returning({ id: messages.id })

  if (!row) {
    return { success: false, error: 'Could not send message' }
  }

  await db.insert(activities).values({
    accountId: session.accountId,
    contactId: session.contactId,
    actorType: 'contact',
    actorId: session.contactId,
    activityType: 'portal_message',
    body: preview,
    visibleToClient: false,
  })

  revalidatePath('/portal')

  return { success: true, data: { id: row.id } }
}
