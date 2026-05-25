'use client'

import { KanbanCard } from '@/components/admin/records/KanbanCard'
import { formatUsdFromCents } from '@/lib/contacts/format'
import type { RecordWithRelations } from '@/lib/records/format'
import { cn } from '@/lib/utils'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { stageDefinitions, users } from '@vantera/db'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'

type Props = {
  stage: typeof stageDefinitions.$inferSelect
  records: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  onUpdated: () => void
  onAddRecord?: () => void
}

export function KanbanColumn({ stage, records, stages, users, onUpdated, onAddRecord }: Props) {
  const labels = useVerticalLabels()
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  const totalValue = records.reduce((sum, r) => sum + r.valueCents, 0)

  return (
    <div
      className={cn(
        'flex min-h-[200px] w-[280px] max-w-[320px] shrink-0 flex-col rounded-xl border border-stone-200 bg-stone-50/80',
        stage.isTerminalWin && 'border-emerald-200 bg-emerald-50/40',
        stage.isTerminalLoss && 'border-red-200 bg-red-50/40',
        isOver && 'border-dashed border-[var(--brand-primary,#1648A0)] bg-[color-mix(in_srgb,var(--brand-primary,#1648A0)_5%,white)]',
      )}
    >
      <div
        className={cn(
          'group flex items-center gap-2 border-b border-stone-200 px-3 py-3',
          stage.isTerminalWin && 'bg-emerald-50',
          stage.isTerminalLoss && 'bg-red-50',
        )}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
        <span className="flex-1 truncate text-sm font-medium text-stone-900">{stage.label}</span>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
          {records.length}
        </span>
        {totalValue > 0 ? (
          <span className="text-xs text-stone-400">{formatUsdFromCents(totalValue)}</span>
        ) : null}
        {onAddRecord ? (
          <button
            type="button"
            onClick={onAddRecord}
            className="hidden text-xs text-stone-500 group-hover:inline"
          >
            + Add
          </button>
        ) : null}
      </div>

      <div ref={setNodeRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        <SortableContext items={records.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {records.length === 0 ? (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">
              No {labels.records.toLowerCase()} in {stage.label}
            </div>
          ) : (
            records.map((record) => (
              <KanbanCard
                key={record.id}
                record={record}
                stages={stages}
                users={users}
                onUpdated={onUpdated}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
