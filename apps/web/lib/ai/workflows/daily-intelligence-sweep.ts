// Workflow: daily-intelligence-sweep.
//
// The autonomous heartbeat of the brain. Runs once per day per account
// (triggered by the /api/cron/ai/daily-sweep route). Each sweep:
//
//   1. Refreshes the account's business_context memory.
//   2. Scores all open pipeline records that look stale (in-stage > 3d
//      and no recent activity).
//   3. Generates fresh intelligence signals.
//   4. Cleans up superseded signals from prior sweeps.
//
// Designed to be cheap when there's nothing to do (a quiet account with
// zero open records spends two queries and produces no model calls).

import { db } from '@/lib/db/client'
import { env } from '@/lib/env'
import {
  activities,
  intelligenceSignals,
  records,
  stageDefinitions,
} from '@vantera/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { loadBusinessContext } from '../context'
import { generateSignals } from '../tools/generate-signals'
import { scoreRecord } from '../tools/score-record'
import { summarizeBusinessContext } from '../tools/summarize-business-context'

const STALE_STAGE_DAYS = 3
const SCORE_RECORDS_PER_SWEEP = 10
const SIGNAL_TTL_DAYS = 7

export type DailySweepResult = {
  ranAt: string
  accountId: string
  refreshedContext: boolean
  scoredRecords: number
  newSignals: number
  expiredSignals: number
  errors: string[]
}

export async function dailyIntelligenceSweep(
  accountId: string,
  ownerUserId: string,
): Promise<DailySweepResult> {
  const result: DailySweepResult = {
    ranAt: new Date().toISOString(),
    accountId,
    refreshedContext: false,
    scoredRecords: 0,
    newSignals: 0,
    expiredSignals: 0,
    errors: [],
  }

  try {
    const ctx = await loadBusinessContext(
      accountId,
      ownerUserId,
      env.NEXT_PUBLIC_APP_URL,
      env.RESEND_API_KEY || null,
    )

    // Step 1: refresh account-level summary.
    const summary = await summarizeBusinessContext(ctx)
    result.refreshedContext = summary.ok
    if (!summary.ok) result.errors.push(`summarize: ${summary.reason}`)

    // Step 2: score stale records.
    const staleRecords = await pickStaleRecords(accountId)
    for (const rec of staleRecords.slice(0, SCORE_RECORDS_PER_SWEEP)) {
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
          daysInCurrentStage: daysSince(rec.updatedAt, now),
          daysSinceCreated: daysSince(rec.createdAt, now),
          recentActivity: recentActivity.map((a) => ({
            activityType: a.activityType,
            body: a.body,
            ageDays: daysSince(a.createdAt, now),
          })),
        },
      })
      if (scored.ok) {
        result.scoredRecords += 1
      } else {
        result.errors.push(`score(${rec.id}): ${scored.reason}`)
      }
    }

    // Step 3: expire old signals.
    const expired = await db
      .delete(intelligenceSignals)
      .where(
        and(
          eq(intelligenceSignals.accountId, accountId),
          sql`${intelligenceSignals.createdAt} < now() - interval '${sql.raw(String(SIGNAL_TTL_DAYS))} days'`,
        ),
      )
      .returning({ id: intelligenceSignals.id })
    result.expiredSignals = expired.length

    // Step 4: regenerate signals against the freshly summarized context.
    const refreshedCtx = await loadBusinessContext(
      accountId,
      ownerUserId,
      env.NEXT_PUBLIC_APP_URL,
      env.RESEND_API_KEY || null,
    )
    const signals = await generateSignals(refreshedCtx)
    if (signals.ok) {
      result.newSignals = signals.signals.length
    } else {
      result.errors.push(`signals: ${signals.reason}`)
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'unknown sweep failure')
  }

  return result
}

async function pickStaleRecords(accountId: string): Promise<
  Array<{
    id: string
    recordType: string
    title: string
    stageLabel: string
    valueCents: number
    createdAt: Date
    updatedAt: Date
  }>
> {
  return db
    .select({
      id: records.id,
      recordType: records.recordType,
      title: records.title,
      stageLabel: stageDefinitions.label,
      valueCents: records.valueCents,
      createdAt: records.createdAt,
      updatedAt: records.updatedAt,
    })
    .from(records)
    .innerJoin(stageDefinitions, eq(stageDefinitions.id, records.stageId))
    .where(
      and(
        eq(records.accountId, accountId),
        sql`${records.deletedAt} IS NULL`,
        sql`${records.completedAt} IS NULL`,
        sql`${records.updatedAt} < now() - interval '${sql.raw(String(STALE_STAGE_DAYS))} days'`,
        eq(stageDefinitions.isTerminalWin, false),
        eq(stageDefinitions.isTerminalLoss, false),
      ),
    )
    .orderBy(records.updatedAt)
    .limit(SCORE_RECORDS_PER_SWEEP * 2)
}

function daysSince(date: Date, nowMs: number): number {
  const diffMs = nowMs - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}
