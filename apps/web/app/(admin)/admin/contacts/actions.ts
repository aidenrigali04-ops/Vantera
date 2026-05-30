'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { findContact } from '@/lib/db/queries'
import { activities, contacts } from '@vantera/db'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createContactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  type: z
    .enum(['customer', 'tenant', 'owner', 'agency_client', 'buyer', 'seller', 'landlord'])
    .default('customer'),
  source: z.string().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
})

const updateContactSchema = createContactSchema.partial()

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>

async function insertContactActivity(
  accountId: string,
  contactId: string,
  userId: string,
  activityType: string,
  body?: string,
) {
  await db.insert(activities).values({
    accountId,
    contactId,
    actorType: 'user',
    actorId: userId,
    activityType,
    body,
    visibleToClient: false,
  })
}

export async function createContact(input: CreateContactInput): Promise<ActionResult<typeof contacts.$inferSelect>> {
  const session = await requireAdminSession()
  const parsed = createContactSchema.safeParse(input)

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data

  const [contact] = await db
    .insert(contacts)
    .values({
      accountId: session.accountId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      type: data.type,
      source: data.source || null,
      addressLine1: data.addressLine1 || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      lifecycleStage: 'active_client',
    })
    .returning()

  await insertContactActivity(
    session.accountId,
    contact!.id,
    session.userId,
    'contact_created',
    `${data.firstName} ${data.lastName} was added`,
  )

  revalidatePath('/admin/contacts')
  revalidatePath('/admin/crm/clients')
  return { success: true, data: contact! }
}

export async function updateContact(
  contactId: string,
  input: UpdateContactInput,
): Promise<ActionResult<typeof contacts.$inferSelect>> {
  const session = await requireAdminSession()
  const existing = await findContact(session.accountId, contactId)

  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  const parsed = updateContactSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data

  const [updated] = await db
    .update(contacts)
    .set({
      ...data,
      email: data.email === '' ? null : data.email ?? existing.email,
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, session.accountId)))
    .returning()

  await insertContactActivity(session.accountId, contactId, session.userId, 'contact_updated')

  revalidatePath('/admin/contacts')
  revalidatePath('/admin/crm/clients')
  revalidatePath(`/admin/contacts/${contactId}`)
  revalidatePath(`/admin/crm/clients/${contactId}`)
  return { success: true, data: updated! }
}

export async function archiveContact(contactId: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findContact(session.accountId, contactId)

  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  await db
    .update(contacts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, session.accountId)))

  revalidatePath('/admin/contacts')
  revalidatePath('/admin/crm/clients')
  return { success: true, data: undefined }
}

export async function addTag(contactId: string, tag: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findContact(session.accountId, contactId)

  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  const trimmed = tag.trim()
  if (!trimmed) {
    return { success: false, error: 'Tag cannot be empty' }
  }

  const nextTags = Array.from(new Set([...(existing.tags ?? []), trimmed]))

  await db
    .update(contacts)
    .set({ tags: nextTags, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, session.accountId)))

  revalidatePath(`/admin/contacts/${contactId}`)
  revalidatePath(`/admin/crm/clients/${contactId}`)
  return { success: true, data: undefined }
}

export async function removeTag(contactId: string, tag: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findContact(session.accountId, contactId)

  if (!existing) {
    return { success: false, error: 'Contact not found' }
  }

  const nextTags = (existing.tags ?? []).filter((t) => t !== tag)

  await db
    .update(contacts)
    .set({ tags: nextTags, updatedAt: new Date() })
    .where(and(eq(contacts.id, contactId), eq(contacts.accountId, session.accountId)))

  revalidatePath(`/admin/contacts/${contactId}`)
  revalidatePath(`/admin/crm/clients/${contactId}`)
  return { success: true, data: undefined }
}

export async function countContactsTotal(accountId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), isNull(contacts.deletedAt)))

  return row?.count ?? 0
}
