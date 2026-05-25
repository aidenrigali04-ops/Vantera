'use client'

import { updateRecord } from '@/app/(admin)/admin/records/actions'
import { KanbanColumn } from '@/components/admin/records/KanbanColumn'
import type { RecordWithRelations } from '@/lib/records/format'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import type { stageDefinitions, users } from '@vantera/db'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { KanbanCard } from './KanbanCard'

type Props = {
  initialRecords: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  accountId: string
  recordType: string
  onAddRecord?: () => void
}

export function KanbanBoard({
  initialRecords,
  stages,
  users,
  accountId,
  recordType,
  onAddRecord,
}: Props) {
  const queryClient = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [optimisticRecords, setOptimisticRecords] = useState<RecordWithRelations[] | null>(null)

  const queryKey = ['records', accountId, recordType]

  const { data: fetchedRecords = initialRecords } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/records?recordType=${encodeURIComponent(recordType)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to load records')
      return json.data as RecordWithRelations[]
    },
    initialData: initialRecords,
  })

  const records = optimisticRecords ?? fetchedRecords

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const channel = supabase
      .channel(`records-${accountId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'records',
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [accountId, queryClient, queryKey])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const recordsByStage = useMemo(() => {
    const map = new Map<string, RecordWithRelations[]>()
    for (const stage of stages) {
      map.set(stage.id, [])
    }
    for (const record of records) {
      const list = map.get(record.stageId) ?? []
      list.push(record)
      map.set(record.stageId, list)
    }
    return map
  }, [records, stages])

  const activeRecord = activeId ? records.find((r) => r.id === activeId) : null

  const invalidate = () => {
    setOptimisticRecords(null)
    void queryClient.invalidateQueries({ queryKey })
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const recordId = String(active.id)
    const record = records.find((r) => r.id === recordId)
    if (!record) return

    const overId = String(over.id)
    const targetStageId = stages.some((s) => s.id === overId)
      ? overId
      : records.find((r) => r.id === overId)?.stageId

    if (!targetStageId || targetStageId === record.stageId) return

    const previous = records
    setOptimisticRecords(
      records.map((r) => (r.id === recordId ? { ...r, stageId: targetStageId } : r)),
    )

    const result = await updateRecord(recordId, { stageId: targetStageId })
    if (!result.success) {
      setOptimisticRecords(previous)
      toast.error(result.error)
      return
    }

    toast.success('Stage updated')
    invalidate()
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-[calc(100vh-220px)] gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            records={recordsByStage.get(stage.id) ?? []}
            stages={stages}
            users={users}
            onUpdated={invalidate}
            onAddRecord={onAddRecord}
          />
        ))}
      </div>

      <DragOverlay>
        {activeRecord ? (
          <KanbanCard
            record={activeRecord}
            isDragging
            stages={stages}
            users={users}
            onUpdated={invalidate}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
