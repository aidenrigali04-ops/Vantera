'use server'

import type { ActionResult } from '@/lib/auth/types'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import type { ImportEntity } from '@/lib/import/fields'
import { activities, contacts, leads, records, stageDefinitions } from '@vantera/db'
import { and, eq, ilike, isNull, or } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const MAX_ROWS = 500

const clientRowSchema = z.object({
  clientName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  type: z.string().optional(),
  source: z.string().optional(),
})

const leadRowSchema = z.object({
  company: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
})

const dealRowSchema = z.object({
  title: z.string().min(1),
  contactEmail: z.string().optional(),
  clientName: z.string().optional(),
  stage: z.string().optional(),
  value: z.string().optional(),
  closeProbability: z.string().optional(),
})

type ImportResult = {
  imported: number
  skipped: number
  errors: string[]
}

function parseClientName(row: z.infer<typeof clientRowSchema>): {
  firstName: string
  lastName: string
  source: string | null
} {
  if (row.firstName?.trim()) {
    return {
      firstName: row.firstName.trim(),
      lastName: row.lastName?.trim() || 'Contact',
      source: row.clientName?.trim() || row.source?.trim() || null,
    }
  }

  const name = row.clientName?.trim()
  if (!name) {
    return { firstName: 'New', lastName: 'Client', source: null }
  }

  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { firstName: parts[0] ?? 'New', lastName: 'Team', source: name }
  }

  return {
    firstName: parts[0] ?? 'New',
    lastName: parts.slice(1).join(' ') || 'Contact',
    source: name,
  }
}

function parseDollarsToCents(raw?: string): number {
  if (!raw?.trim()) return 0
  const cleaned = raw.replace(/[$,\s]/g, '')
  const value = Number.parseFloat(cleaned)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

function parseProbability(raw?: string): number {
  if (!raw?.trim()) return 50
  const cleaned = raw.replace(/[%\s]/g, '')
  const value = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, value))
}

const CONTACT_TYPES = new Set([
  'customer',
  'tenant',
  'owner',
  'agency_client',
  'buyer',
  'seller',
  'landlord',
])

const LEAD_STATUSES = new Set([
  'new',
  'contacted',
  'connected',
  'nurturing',
  'qualified',
  'discovery_booked',
  'proposal_sent',
  'won',
  'lost',
])

export async function importClientsFromCsv(
  rows: Record<string, string>[],
): Promise<ActionResult<ImportResult>> {
  const session = await requireAdminSession()
  if (rows.length > MAX_ROWS) {
    return { success: false, error: `Import limited to ${MAX_ROWS} rows per file.` }
  }

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += 1) {
    const parsed = clientRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      skipped += 1
      if (errors.length < 5) errors.push(`Row ${i + 1}: invalid row`)
      continue
    }

    const row = parsed.data
    if (!row.clientName?.trim() && !row.firstName?.trim()) {
      skipped += 1
      if (errors.length < 5) errors.push(`Row ${i + 1}: client name is required`)
      continue
    }

    const name = parseClientName(row)
    const typeRaw = row.type?.trim().toLowerCase().replace(/\s+/g, '_')
    const type =
      typeRaw && CONTACT_TYPES.has(typeRaw)
        ? (typeRaw as typeof contacts.$inferInsert.type)
        : 'agency_client'

    try {
      const [contact] = await db
        .insert(contacts)
        .values({
          accountId: session.accountId,
          firstName: name.firstName,
          lastName: name.lastName,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          type,
          source: name.source || row.source?.trim() || null,
          lifecycleStage: 'active_client',
        })
        .returning()

      await db.insert(activities).values({
        accountId: session.accountId,
        contactId: contact!.id,
        actorType: 'user',
        actorId: session.userId,
        activityType: 'contact_created',
        body: `${name.firstName} ${name.lastName} was imported`,
        visibleToClient: false,
      })

      imported += 1
    } catch (err) {
      skipped += 1
      if (errors.length < 5) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Import failed'}`)
      }
    }
  }

  if (imported > 0) {
    revalidatePath('/admin/clients')
    revalidatePath('/admin/dashboard')
  }

  return { success: true, data: { imported, skipped, errors } }
}

export async function importLeadsFromCsv(
  rows: Record<string, string>[],
): Promise<ActionResult<ImportResult>> {
  const session = await requireAdminSession()
  if (rows.length > MAX_ROWS) {
    return { success: false, error: `Import limited to ${MAX_ROWS} rows per file.` }
  }

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += 1) {
    const parsed = leadRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      skipped += 1
      if (errors.length < 5) errors.push(`Row ${i + 1}: company is required`)
      continue
    }

    const row = parsed.data
    const statusRaw = row.status?.trim().toLowerCase()
    const relationshipStatus =
      statusRaw && LEAD_STATUSES.has(statusRaw)
        ? (statusRaw as typeof leads.$inferInsert.relationshipStatus)
        : 'new'

    try {
      const [lead] = await db
        .insert(leads)
        .values({
          accountId: session.accountId,
          company: row.company.trim(),
          firstName: row.firstName?.trim() || null,
          lastName: row.lastName?.trim() || null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          title: row.title?.trim() || null,
          source: 'csv',
          relationshipStatus,
          ownerId: session.userId,
        })
        .returning()

      await db.insert(activities).values({
        accountId: session.accountId,
        leadId: lead!.id,
        actorType: 'user',
        actorId: session.userId,
        activityType: 'lead_created',
        body: 'Lead imported from CSV',
      })

      imported += 1
    } catch (err) {
      skipped += 1
      if (errors.length < 5) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Import failed'}`)
      }
    }
  }

  if (imported > 0) {
    revalidatePath('/admin/crm/pipeline')
    revalidatePath('/admin/dashboard')
  }

  return { success: true, data: { imported, skipped, errors } }
}

export async function importDealsFromCsv(
  rows: Record<string, string>[],
): Promise<ActionResult<ImportResult>> {
  const session = await requireAdminSession()
  if (rows.length > MAX_ROWS) {
    return { success: false, error: `Import limited to ${MAX_ROWS} rows per file.` }
  }

  const stages = await db
    .select()
    .from(stageDefinitions)
    .where(
      and(eq(stageDefinitions.accountId, session.accountId), eq(stageDefinitions.recordType, 'deal')),
    )
    .orderBy(stageDefinitions.position)

  if (stages.length === 0) {
    return { success: false, error: 'No deal pipeline stages configured for this workspace.' }
  }

  const defaultStage =
    stages.find((s) => !s.isTerminalWin && !s.isTerminalLoss) ?? stages[0]!

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += 1) {
    const parsed = dealRowSchema.safeParse(rows[i])
    if (!parsed.success) {
      skipped += 1
      if (errors.length < 5) errors.push(`Row ${i + 1}: title is required`)
      continue
    }

    const row = parsed.data
    let contactId: string | null = null

    if (row.contactEmail?.trim()) {
      const [byEmail] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, session.accountId),
            isNull(contacts.deletedAt),
            ilike(contacts.email, row.contactEmail.trim()),
          ),
        )
        .limit(1)
      contactId = byEmail?.id ?? null
    }

    if (!contactId && row.clientName?.trim()) {
      const name = row.clientName.trim()
      const [byName] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.accountId, session.accountId),
            isNull(contacts.deletedAt),
            or(
              ilike(contacts.source, name),
              ilike(contacts.firstName, name.split(/\s+/)[0] ?? name),
            ),
          ),
        )
        .limit(1)
      contactId = byName?.id ?? null
    }

    if (!contactId) {
      skipped += 1
      if (errors.length < 5) {
        errors.push(`Row ${i + 1}: matching client not found — import clients first`)
      }
      continue
    }

    const stageLabel = row.stage?.trim().toLowerCase()
    const stage =
      (stageLabel
        ? stages.find((s) => s.label.toLowerCase() === stageLabel)
        : null) ?? defaultStage

    try {
      const [record] = await db
        .insert(records)
        .values({
          accountId: session.accountId,
          contactId,
          recordType: 'deal',
          title: row.title.trim(),
          stageId: stage.id,
          valueCents: parseDollarsToCents(row.value),
          closeProbability: parseProbability(row.closeProbability),
          isPipeline: true,
          source: 'csv_import',
          priority: 'normal',
        })
        .returning()

      await db.insert(activities).values({
        accountId: session.accountId,
        recordId: record!.id,
        contactId,
        actorType: 'user',
        actorId: session.userId,
        activityType: 'record_created',
        body: `${row.title.trim()} was imported`,
        visibleToClient: false,
      })

      imported += 1
    } catch (err) {
      skipped += 1
      if (errors.length < 5) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Import failed'}`)
      }
    }
  }

  if (imported > 0) {
    revalidatePath('/admin/dashboard')
    revalidatePath('/admin/clients')
  }

  return { success: true, data: { imported, skipped, errors } }
}

export async function importCsvRows(
  entity: ImportEntity,
  rows: Record<string, string>[],
): Promise<ActionResult<ImportResult>> {
  switch (entity) {
    case 'clients':
      return importClientsFromCsv(rows)
    case 'leads':
      return importLeadsFromCsv(rows)
    case 'deals':
      return importDealsFromCsv(rows)
    default:
      return { success: false, error: 'Unknown import type' }
  }
}
