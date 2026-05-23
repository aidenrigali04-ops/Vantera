import { isAiEnabled, listMemory } from '@/lib/ai'
import { requireAdminSession } from '@/lib/auth/require-session'
import { db } from '@/lib/db/client'
import { aiObservations, intelligenceSignals } from '@vantera/db'
import { desc, eq } from 'drizzle-orm'
import { BrainClient } from './brain-client'

export const dynamic = 'force-dynamic'

export default async function AIBrainPage() {
  const session = await requireAdminSession()
  const accountId = session.accountId

  const [memoryRows, observationRows, signalRows] = await Promise.all([
    listMemory(accountId, undefined, 50),
    db
      .select({
        id: aiObservations.id,
        kind: aiObservations.kind,
        payload: aiObservations.payload,
        outcome: aiObservations.outcome,
        occurredAt: aiObservations.occurredAt,
      })
      .from(aiObservations)
      .where(eq(aiObservations.accountId, accountId))
      .orderBy(desc(aiObservations.occurredAt))
      .limit(40),
    db
      .select({
        id: intelligenceSignals.id,
        signalType: intelligenceSignals.signalType,
        severity: intelligenceSignals.severity,
        headline: intelligenceSignals.headline,
        recommendation: intelligenceSignals.recommendation,
        confidenceScore: intelligenceSignals.confidenceScore,
        createdAt: intelligenceSignals.createdAt,
      })
      .from(intelligenceSignals)
      .where(eq(intelligenceSignals.accountId, accountId))
      .orderBy(desc(intelligenceSignals.createdAt))
      .limit(20),
  ])

  return (
    <BrainClient
      role={session.role}
      aiEnabled={isAiEnabled()}
      memory={memoryRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        subjectType: row.subjectType,
        subjectId: row.subjectId,
        summary: row.summary,
        confidence: row.confidence,
        version: row.version,
        modelUsed: row.modelUsed,
        updatedAt: row.updatedAt.toISOString(),
      }))}
      observations={observationRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        payload: row.payload as Record<string, unknown>,
        outcome: row.outcome,
        occurredAt: row.occurredAt.toISOString(),
      }))}
      signals={signalRows.map((row) => ({
        id: row.id,
        signalType: row.signalType,
        severity: row.severity,
        headline: row.headline,
        recommendation: row.recommendation ?? '',
        confidenceScore: row.confidenceScore,
        createdAt: row.createdAt.toISOString(),
      }))}
    />
  )
}
