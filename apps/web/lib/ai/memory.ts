// Persistent memory for the AI brain.
//
// Wraps the `ai_memory` table with a small, typed API:
//
//   upsertMemory     — write or refresh a (kind, subject) row, bumping version
//   getMemory        — read a single row by (kind, subject)
//   listMemory       — read all rows of a given kind for an account
//   recordObservation — append-only event log (for the learning loop)
//
// Tools and workflows use this module so they don't have to hand-roll the
// upsert SQL (and so we can swap the storage layer later without rewriting
// callers).

import { db } from '@/lib/db/client'
import {
  aiMemory,
  aiObservations,
} from '@vantera/db'
import { and, desc, eq, sql } from 'drizzle-orm'

export type MemoryKind =
  | 'business_context'
  | 'contact_memory'
  | 'record_memory'
  | 'pattern'
  | 'preference'

export type SubjectType = 'account' | 'contact' | 'record' | 'pattern'

export type ObservationKind =
  | 'tool_called'
  | 'signal_generated'
  | 'signal_dismissed'
  | 'message_drafted'
  | 'message_sent'
  | 'recommendation_accepted'
  | 'recommendation_dismissed'
  | 'prediction_made'
  | 'prediction_outcome'

export type MemoryRow = {
  id: string
  kind: MemoryKind
  subjectType: SubjectType
  subjectId: string
  summary: string
  evidence: Record<string, unknown>
  confidence: number
  version: number
  modelUsed: string | null
  updatedAt: Date
}

export type UpsertMemoryArgs = {
  accountId: string
  kind: MemoryKind
  subjectType: SubjectType
  subjectId: string
  summary: string
  evidence?: Record<string, unknown>
  confidence?: number
  modelUsed?: string | null
}

/**
 * Insert or update a memory row, bumping `version` and `updated_at` on
 * conflict. Returns the resulting row.
 */
export async function upsertMemory(args: UpsertMemoryArgs): Promise<MemoryRow> {
  const [row] = await db
    .insert(aiMemory)
    .values({
      accountId: args.accountId,
      kind: args.kind,
      subjectType: args.subjectType,
      subjectId: args.subjectId,
      summary: args.summary,
      evidence: args.evidence ?? {},
      confidence: clampConfidence(args.confidence ?? 50),
      version: 1,
      modelUsed: args.modelUsed ?? null,
    })
    .onConflictDoUpdate({
      target: [aiMemory.accountId, aiMemory.kind, aiMemory.subjectType, aiMemory.subjectId],
      set: {
        summary: args.summary,
        evidence: args.evidence ?? {},
        confidence: clampConfidence(args.confidence ?? 50),
        modelUsed: args.modelUsed ?? null,
        version: sql`${aiMemory.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row) {
    throw new Error('upsertMemory returned no row')
  }
  return rowToMemory(row)
}

export async function getMemory(args: {
  accountId: string
  kind: MemoryKind
  subjectType: SubjectType
  subjectId: string
}): Promise<MemoryRow | null> {
  const [row] = await db
    .select()
    .from(aiMemory)
    .where(
      and(
        eq(aiMemory.accountId, args.accountId),
        eq(aiMemory.kind, args.kind),
        eq(aiMemory.subjectType, args.subjectType),
        eq(aiMemory.subjectId, args.subjectId),
      ),
    )
    .limit(1)

  return row ? rowToMemory(row) : null
}

export async function listMemory(
  accountId: string,
  kind?: MemoryKind,
  limit = 50,
): Promise<MemoryRow[]> {
  const baseWhere = kind
    ? and(eq(aiMemory.accountId, accountId), eq(aiMemory.kind, kind))
    : eq(aiMemory.accountId, accountId)

  const rows = await db
    .select()
    .from(aiMemory)
    .where(baseWhere)
    .orderBy(desc(aiMemory.updatedAt))
    .limit(limit)

  return rows.map(rowToMemory)
}

export type RecordObservationArgs = {
  accountId: string
  kind: ObservationKind
  payload?: Record<string, unknown>
  outcome?: string | null
  relatedAutomationId?: string | null
  relatedRecordId?: string | null
  relatedContactId?: string | null
  relatedSignalId?: string | null
}

export async function recordObservation(args: RecordObservationArgs): Promise<void> {
  try {
    await db.insert(aiObservations).values({
      accountId: args.accountId,
      kind: args.kind,
      payload: args.payload ?? {},
      outcome: args.outcome ?? null,
      relatedAutomationId: args.relatedAutomationId ?? null,
      relatedRecordId: args.relatedRecordId ?? null,
      relatedContactId: args.relatedContactId ?? null,
      relatedSignalId: args.relatedSignalId ?? null,
    })
  } catch {
    // Telemetry must never break callers.
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.max(0, Math.min(100, Math.round(value)))
}

function rowToMemory(row: {
  id: string
  kind: string
  subjectType: string
  subjectId: string
  summary: string
  evidence: unknown
  confidence: number
  version: number
  modelUsed: string | null
  updatedAt: Date
}): MemoryRow {
  return {
    id: row.id,
    kind: row.kind as MemoryKind,
    subjectType: row.subjectType as SubjectType,
    subjectId: row.subjectId,
    summary: row.summary,
    evidence:
      row.evidence && typeof row.evidence === 'object' && !Array.isArray(row.evidence)
        ? (row.evidence as Record<string, unknown>)
        : {},
    confidence: row.confidence,
    version: row.version,
    modelUsed: row.modelUsed,
    updatedAt: row.updatedAt,
  }
}
