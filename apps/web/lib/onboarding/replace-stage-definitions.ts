import 'server-only'

import { SAMPLE_SOURCE } from '@/lib/sample-data/seed'
import type { TemplateStage } from '@vantera/db'
import type { SupabaseClient } from '@supabase/supabase-js'

type StageRow = {
  id: string
  record_type: string
  label: string
  position: number
  is_terminal_win: boolean
  is_terminal_loss: boolean
}

type RecordRow = {
  id: string
  stage_id: string
  record_type: string
}

function sortStages(stages: StageRow[]): StageRow[] {
  return [...stages].sort((a, b) => a.position - b.position)
}

function stagesForType(stages: StageRow[], recordType: string): StageRow[] {
  return sortStages(stages.filter((stage) => stage.record_type === recordType))
}

function firstPipelineStage(stages: StageRow[]): StageRow | undefined {
  return (
    stages.find((stage) => !stage.is_terminal_win && !stage.is_terminal_loss) ?? stages[0]
  )
}

function pickReplacementStage(
  oldStage: StageRow | undefined,
  recordType: string,
  oldStages: StageRow[],
  newStages: StageRow[],
  templateRecordType: string,
): { stageId: string; recordType: string } {
  let candidates = stagesForType(newStages, recordType)
  let nextRecordType = recordType

  if (candidates.length === 0) {
    candidates = stagesForType(newStages, templateRecordType)
    nextRecordType = templateRecordType
  }

  if (candidates.length === 0) {
    const fallback = firstPipelineStage(sortStages(newStages))
    if (!fallback) {
      throw new Error('Template has no stages to assign records to')
    }
    return { stageId: fallback.id, recordType: fallback.record_type }
  }

  if (!oldStage) {
    const first = firstPipelineStage(candidates)!
    return { stageId: first.id, recordType: nextRecordType }
  }

  if (oldStage.is_terminal_win) {
    const win = candidates.find((stage) => stage.is_terminal_win)
    if (win) return { stageId: win.id, recordType: nextRecordType }
  }

  if (oldStage.is_terminal_loss) {
    const loss = candidates.find((stage) => stage.is_terminal_loss)
    if (loss) return { stageId: loss.id, recordType: nextRecordType }
  }

  const oldSameType = stagesForType(oldStages, oldStage.record_type)
  const oldIndex = Math.max(
    0,
    oldSameType.findIndex((stage) => stage.id === oldStage.id),
  )
  const pool = candidates.filter((stage) => !stage.is_terminal_win && !stage.is_terminal_loss)
  const targetPool = pool.length > 0 ? pool : candidates
  const target = targetPool[Math.min(oldIndex, targetPool.length - 1)] ?? targetPool[0]!

  return { stageId: target.id, recordType: nextRecordType }
}

async function removeDemoPipelineRecords(
  admin: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data: demoRecords, error: demoErr } = await admin
    .from('records')
    .select('id')
    .eq('account_id', accountId)
    .eq('source', SAMPLE_SOURCE)

  if (demoErr) {
    throw new Error(demoErr.message)
  }

  const demoIds = (demoRecords ?? []).map((row) => row.id).filter(Boolean)
  if (demoIds.length === 0) return

  const { error: activityErr } = await admin.from('activities').delete().in('record_id', demoIds)
  if (activityErr) {
    throw new Error(activityErr.message)
  }

  const { error: recordErr } = await admin.from('records').delete().in('id', demoIds)
  if (recordErr) {
    throw new Error(recordErr.message)
  }
}

/**
 * Swap an account's pipeline stages for a personalized template without violating
 * records.stage_id foreign keys. Demo seed records are removed; any remaining
 * records are remapped onto the new stages before old definitions are deleted.
 */
export async function replaceAccountStageDefinitions(
  admin: SupabaseClient,
  accountId: string,
  stages: TemplateStage[],
  templateRecordType: string,
): Promise<number> {
  if (stages.length === 0) {
    const { error } = await admin.from('stage_definitions').delete().eq('account_id', accountId)
    if (error) throw new Error(error.message)
    return 0
  }

  await removeDemoPipelineRecords(admin, accountId)

  const { data: oldStages, error: oldStagesErr } = await admin
    .from('stage_definitions')
    .select('id, record_type, label, position, is_terminal_win, is_terminal_loss')
    .eq('account_id', accountId)

  if (oldStagesErr) {
    throw new Error(oldStagesErr.message)
  }

  const { data: records, error: recordsErr } = await admin
    .from('records')
    .select('id, stage_id, record_type')
    .eq('account_id', accountId)
    .is('deleted_at', null)

  if (recordsErr) {
    throw new Error(recordsErr.message)
  }

  const oldStageById = new Map((oldStages ?? []).map((stage) => [stage.id, stage as StageRow]))

  const { data: insertedStages, error: insertErr } = await admin
    .from('stage_definitions')
    .insert(
      stages.map((stage, index) => ({
        account_id: accountId,
        record_type: stage.recordType ?? templateRecordType,
        label: stage.label,
        position: stage.position ?? index + 1,
        color: stage.color ?? '#64748B',
        triggers_automation: stage.triggersAutomation ?? true,
        is_terminal_win: stage.isTerminalWin ?? false,
        is_terminal_loss: stage.isTerminalLoss ?? false,
      })),
    )
    .select('id, record_type, label, position, is_terminal_win, is_terminal_loss')

  if (insertErr) {
    throw new Error(insertErr.message)
  }

  const newStages = (insertedStages ?? []) as StageRow[]
  if (newStages.length === 0) {
    throw new Error('Failed to create pipeline stages')
  }

  for (const record of (records ?? []) as RecordRow[]) {
    const oldStage = oldStageById.get(record.stage_id)
    const replacement = pickReplacementStage(
      oldStage,
      record.record_type,
      (oldStages ?? []) as StageRow[],
      newStages,
      templateRecordType,
    )

    const { error: updateErr } = await admin
      .from('records')
      .update({
        stage_id: replacement.stageId,
        record_type: replacement.recordType,
      })
      .eq('id', record.id)
      .eq('account_id', accountId)

    if (updateErr) {
      throw new Error(updateErr.message)
    }
  }

  const oldIds = (oldStages ?? []).map((stage) => stage.id)
  if (oldIds.length > 0) {
    const { error: deleteErr } = await admin.from('stage_definitions').delete().in('id', oldIds)
    if (deleteErr) {
      throw new Error(deleteErr.message)
    }
  }

  return newStages.length
}
