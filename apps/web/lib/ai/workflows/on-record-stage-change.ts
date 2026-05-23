// Workflow: on-record-stage-change.
//
// Event-driven: fires whenever a record transitions to a new stage. Reads
// the new stage, decides whether to take any AI-driven action, and persists
// what it did to the brain's memory + observation log.
//
// Today this is the lightest of the three workflows — it re-scores the
// record at the new stage and updates record memory. As the platform grows
// it'll branch on stage semantics (e.g. on "Quote Approved", auto-draft a
// confirmation message via draft-message).

import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import { activities, records, stageDefinitions } from '@vantera/db'
import { desc, eq } from 'drizzle-orm'
import { loadBusinessContext } from '../context'
import { recordObservation } from '../memory'
import { scoreRecord } from '../tools/score-record'

export type StageChangeResult = {
  ranAt: string
  recordId: string
  newStage: string
  rescored: boolean
  errors: string[]
}

export async function onRecordStageChange(args: {
  accountId: string
  ownerUserId: string
  recordId: string
}): Promise<StageChangeResult> {
  const result: StageChangeResult = {
    ranAt: new Date().toISOString(),
    recordId: args.recordId,
    newStage: '',
    rescored: false,
    errors: [],
  }

  try {
    const [rec] = await db
      .select({
        id: records.id,
        recordType: records.recordType,
        title: records.title,
        stageLabel: stageDefinitions.label,
        valueCents: records.valueCents,
        createdAt: records.createdAt,
        updatedAt: records.updatedAt,
        isTerminalWin: stageDefinitions.isTerminalWin,
        isTerminalLoss: stageDefinitions.isTerminalLoss,
      })
      .from(records)
      .innerJoin(stageDefinitions, eq(stageDefinitions.id, records.stageId))
      .where(eq(records.id, args.recordId))
      .limit(1)

    if (!rec) {
      result.errors.push('record_not_found')
      return result
    }

    result.newStage = rec.stageLabel

    // If the record moved to a terminal stage, log the predicted outcome so
    // the learning loop can later compare against earlier predictions, then
    // skip scoring (terminal records don't need a probability).
    if (rec.isTerminalWin || rec.isTerminalLoss) {
      await recordObservation({
        accountId: args.accountId,
        kind: 'prediction_outcome',
        payload: {
          stage: rec.stageLabel,
          outcome: rec.isTerminalWin ? 'win' : 'loss',
        },
        outcome: rec.isTerminalWin ? 'win' : 'loss',
        relatedRecordId: rec.id,
      })
      return result
    }

    const ctx = await loadBusinessContext(
      args.accountId,
      args.ownerUserId,
      env.NEXT_PUBLIC_APP_URL,
      env.RESEND_API_KEY || null,
    )

    const recentActivity = await db
      .select({
        activityType: activities.activityType,
        body: activities.body,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .where(eq(activities.recordId, rec.id))
      .orderBy(desc(activities.createdAt))
      .limit(4)

    const now = Date.now()
    const scored = await scoreRecord({
      ctx,
      record: {
        id: rec.id,
        recordType: rec.recordType,
        title: rec.title,
        currentStage: rec.stageLabel,
        valueCents: rec.valueCents,
        daysInCurrentStage: 0, // just changed
        daysSinceCreated: Math.max(
          0,
          Math.floor((now - rec.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        ),
        recentActivity: recentActivity.map((a) => ({
          activityType: a.activityType,
          body: a.body,
          ageDays: Math.max(
            0,
            Math.floor((now - a.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          ),
        })),
      },
    })

    if (scored.ok) {
      result.rescored = true
    } else {
      result.errors.push(`score: ${scored.reason}`)
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'unknown')
  }

  return result
}
