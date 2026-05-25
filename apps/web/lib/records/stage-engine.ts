import { db } from '@/lib/db/client'
import { getStageDefinitions } from '@/lib/db/queries'
import {
  activities,
  automationRuns,
  automations,
  intelligenceSignals,
  records,
  stageDefinitions,
} from '@vantera/db'
import { and, asc, eq, isNull } from 'drizzle-orm'

export type StageTransitionInput = {
  recordId: string
  newStageId: string
  accountId: string
  userId: string
  reason?: string
}

export type StageTransitionResult = {
  recordId: string
  fromStageId: string
  toStageId: string
}

export async function getStageDefinitionsForAccount(accountId: string, recordType: string) {
  return getStageDefinitions(accountId, recordType)
}

export async function getFirstStage(accountId: string, recordType: string) {
  const stages = await getStageDefinitions(accountId, recordType)
  return stages[0] ?? null
}

export async function transitionStage(input: StageTransitionInput): Promise<StageTransitionResult> {
  const { recordId, newStageId, accountId, userId, reason } = input

  return db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(records)
      .where(
        and(eq(records.id, recordId), eq(records.accountId, accountId), isNull(records.deletedAt)),
      )
      .limit(1)

    if (!record) {
      throw new Error('Record not found')
    }

    if (record.stageId === newStageId) {
      return { recordId, fromStageId: record.stageId, toStageId: newStageId }
    }

    const [oldStage] = await tx
      .select()
      .from(stageDefinitions)
      .where(and(eq(stageDefinitions.id, record.stageId), eq(stageDefinitions.accountId, accountId)))
      .limit(1)

    const [newStage] = await tx
      .select()
      .from(stageDefinitions)
      .where(and(eq(stageDefinitions.id, newStageId), eq(stageDefinitions.accountId, accountId)))
      .limit(1)

    if (!newStage) {
      throw new Error('Invalid stage')
    }

    await tx
      .update(records)
      .set({ stageId: newStageId, updatedAt: new Date() })
      .where(and(eq(records.id, recordId), eq(records.accountId, accountId)))

    await tx.insert(activities).values({
      accountId,
      recordId,
      contactId: record.contactId,
      actorType: 'user',
      actorId: userId,
      activityType: 'stage_change',
      body: reason ?? `Stage changed from ${oldStage?.label ?? 'Unknown'} to ${newStage.label}`,
      metadata: {
        fromStageId: record.stageId,
        toStageId: newStageId,
        fromStageLabel: oldStage?.label ?? null,
        toStageLabel: newStage.label,
      },
      visibleToClient: newStage.triggersAutomation,
    })

    const matchingAutomations = await tx
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.accountId, accountId),
          eq(automations.isActive, true),
          eq(automations.triggerEvent, 'stage_changed'),
          isNull(automations.deletedAt),
        ),
      )

    for (const automation of matchingAutomations) {
      await tx.insert(automationRuns).values({
        accountId,
        automationId: automation.id,
        triggerEvent: 'stage_changed',
        triggerPayload: {
          recordId,
          fromStageId: record.stageId,
          toStageId: newStageId,
        },
        actionType: 'automation_chain',
        status: 'pending',
      })
    }

    await tx.insert(intelligenceSignals).values({
      accountId,
      recordId,
      contactId: record.contactId,
      signalType: 'rescore_requested',
      severity: 'green',
      headline: 'Rescore requested',
      recommendation: null,
      confidenceScore: 0,
    })

    return { recordId, fromStageId: record.stageId, toStageId: newStageId }
  })
}

export async function getStageById(accountId: string, stageId: string) {
  const [stage] = await db
    .select()
    .from(stageDefinitions)
    .where(and(eq(stageDefinitions.id, stageId), eq(stageDefinitions.accountId, accountId)))
    .limit(1)

  return stage ?? null
}

export async function listStageDefinitions(accountId: string) {
  return db
    .select()
    .from(stageDefinitions)
    .where(eq(stageDefinitions.accountId, accountId))
    .orderBy(asc(stageDefinitions.position))
}
