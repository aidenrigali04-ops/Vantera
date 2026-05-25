'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { findContact, findRecord } from '@/lib/db/queries'
import { transitionStage } from '@/lib/records/stage-engine'
import { activities, records, stageDefinitions } from '@vantera/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createRecordSchema = z.object({
  title: z.string().min(1),
  contactId: z.string().uuid(),
  stageId: z.string().uuid(),
  recordType: z.string().min(1),
  priority: z.enum(['urgent', 'high', 'normal', 'low']).default('normal'),
  valueCents: z.number().int().nonnegative().default(0),
  assignedUserId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  source: z.string().optional(),
})

const updateRecordSchema = createRecordSchema.partial().extend({
  stageId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateRecordInput = z.infer<typeof createRecordSchema>
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>

async function validateStage(accountId: string, stageId: string) {
  const [stage] = await db
    .select()
    .from(stageDefinitions)
    .where(and(eq(stageDefinitions.id, stageId), eq(stageDefinitions.accountId, accountId)))
    .limit(1)
  return stage ?? null
}

export async function createRecord(input: CreateRecordInput): Promise<ActionResult<typeof records.$inferSelect>> {
  const session = await requireAdminSession()
  const parsed = createRecordSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data
  const contact = await findContact(session.accountId, data.contactId)
  if (!contact) return { success: false, error: 'Contact not found' }

  const stage = await validateStage(session.accountId, data.stageId)
  if (!stage) return { success: false, error: 'Stage not found' }

  const [record] = await db
    .insert(records)
    .values({
      accountId: session.accountId,
      contactId: data.contactId,
      recordType: data.recordType,
      title: data.title,
      stageId: data.stageId,
      priority: data.priority,
      valueCents: data.valueCents,
      assignedUserId: data.assignedUserId ?? null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      source: data.source ?? null,
    })
    .returning()

  await db.insert(activities).values({
    accountId: session.accountId,
    recordId: record!.id,
    contactId: data.contactId,
    actorType: 'user',
    actorId: session.userId,
    activityType: 'record_created',
    body: `${data.title} was created`,
    visibleToClient: false,
  })

  revalidatePath('/admin/records')
  return { success: true, data: record! }
}

export async function updateRecord(
  recordId: string,
  input: UpdateRecordInput,
): Promise<ActionResult<typeof records.$inferSelect>> {
  const session = await requireAdminSession()
  const existing = await findRecord(session.accountId, recordId)
  if (!existing) return { success: false, error: 'Record not found' }

  const parsed = updateRecordSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data

  if (data.stageId && data.stageId !== existing.stageId) {
    await transitionStage({
      recordId,
      newStageId: data.stageId,
      accountId: session.accountId,
      userId: session.userId,
    })
  }

  const fieldsForUpdate = { ...data }
  delete fieldsForUpdate.stageId
  delete fieldsForUpdate.metadata
  const patch: Record<string, unknown> = { ...fieldsForUpdate, updatedAt: new Date() }

  if (data.metadata) {
    const merged = { ...(existing.metadata as Record<string, unknown>), ...data.metadata }
    if (Object.keys(merged).length > 50) {
      return { success: false, error: 'Metadata cannot exceed 50 keys' }
    }
    patch.metadata = merged
  }

  if (data.scheduledAt !== undefined) {
    patch.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null
  }

  const [updated] = await db
    .update(records)
    .set(patch)
    .where(and(eq(records.id, recordId), eq(records.accountId, session.accountId)))
    .returning()

  revalidatePath('/admin/records')
  revalidatePath(`/admin/records/${recordId}`)
  return { success: true, data: updated! }
}

export async function archiveRecord(recordId: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findRecord(session.accountId, recordId)
  if (!existing) return { success: false, error: 'Record not found' }

  await db
    .update(records)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(records.id, recordId), eq(records.accountId, session.accountId)))

  await db.insert(activities).values({
    accountId: session.accountId,
    recordId,
    contactId: existing.contactId,
    actorType: 'user',
    actorId: session.userId,
    activityType: 'record_archived',
    visibleToClient: false,
  })

  revalidatePath('/admin/records')
  return { success: true, data: undefined }
}

export async function addNote(recordId: string, body: string): Promise<ActionResult> {
  const session = await requireAdminSession()
  const existing = await findRecord(session.accountId, recordId)
  if (!existing) return { success: false, error: 'Record not found' }

  if (!body.trim()) return { success: false, error: 'Note cannot be empty' }

  await db.insert(activities).values({
    accountId: session.accountId,
    recordId,
    contactId: existing.contactId,
    actorType: 'user',
    actorId: session.userId,
    activityType: 'note',
    body: body.trim(),
    visibleToClient: false,
  })

  revalidatePath(`/admin/records/${recordId}`)
  return { success: true, data: undefined }
}

export async function updateMetadata(
  recordId: string,
  metadata: Record<string, unknown>,
): Promise<ActionResult<typeof records.$inferSelect>> {
  return updateRecord(recordId, { metadata })
}
