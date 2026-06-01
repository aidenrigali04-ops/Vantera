import { db } from '@/lib/db/client'
import { segmentKey } from '@/lib/sdr/schedule'
import type { SdrReplyType } from '@/lib/sdr/types'
import { aiMemory } from '@vantera/db'
import { and, desc, eq, sql } from 'drizzle-orm'

export async function fetchSdrSegmentMemory(
  accountId: string,
  vertical: string,
  employeeCount: number | null,
  limit = 3,
): Promise<string> {
  const key = segmentKey(vertical, employeeCount)

  const rows = await db
    .select({ summary: aiMemory.summary })
    .from(aiMemory)
    .where(
      and(
        eq(aiMemory.accountId, accountId),
        eq(aiMemory.kind, 'pattern'),
        eq(aiMemory.subjectType, 'account'),
        sql`${aiMemory.evidence}->>'segmentKey' = ${key}`,
      ),
    )
    .orderBy(desc(aiMemory.confidence))
    .limit(limit)

  if (rows.length === 0) return ''
  return rows.map((row) => row.summary).join('\n')
}

export async function reinforceSdrSegmentMemory(input: {
  accountId: string
  vertical: string
  employeeCount: number | null
  stepNumber: number
  channel: string
  openingHook: string
  outcome: SdrReplyType
}): Promise<void> {
  const key = segmentKey(input.vertical, input.employeeCount)
  const summary = `Step ${input.stepNumber} ${input.channel} for ${key}: opening "${input.openingHook.slice(0, 40)}" → ${input.outcome}`

  await db
    .insert(aiMemory)
    .values({
      accountId: input.accountId,
      kind: 'pattern',
      subjectType: 'account',
      subjectId: input.accountId,
      summary,
      evidence: {
        segmentKey: key,
        stepNumber: input.stepNumber,
        channel: input.channel,
        outcome: input.outcome,
      },
      confidence: input.outcome === 'interested' ? 75 : 45,
    })
    .onConflictDoUpdate({
      target: [
        aiMemory.accountId,
        aiMemory.kind,
        aiMemory.subjectType,
        aiMemory.subjectId,
      ],
      set: {
        summary,
        evidence: {
          segmentKey: key,
          stepNumber: input.stepNumber,
          channel: input.channel,
          outcome: input.outcome,
        },
        confidence: sql`LEAST(100, ${aiMemory.confidence} + 5)`,
        updatedAt: new Date(),
      },
    })
}
