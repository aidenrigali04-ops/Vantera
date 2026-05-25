'use client'

import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { useUIStore } from '@/lib/stores/ui-store'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/admin/records/KanbanBoard'
import { CalendarView } from '@/components/admin/records/CalendarView'
import { ListView } from '@/components/admin/records/ListView'
import { RecordCreateSheet } from '@/components/admin/records/RecordCreateSheet'
import type { RecordWithRelations } from '@/lib/records/format'
import type { stageDefinitions, users } from '@vantera/db'
import { LayoutGrid, Calendar, List, Plus } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  initialRecords: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  recordType: string
  accountId: string
}

export function RecordsPageClient({
  initialRecords,
  stages,
  users,
  recordType,
  accountId,
}: Props) {
  const labels = useVerticalLabels()
  const { recordsView, setRecordsView } = useUIStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [prefillSchedule, setPrefillSchedule] = useState<string | undefined>()

  const openCreate = (scheduledAt?: Date) => {
    setPrefillSchedule(scheduledAt?.toISOString())
    setCreateOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-stone-900">{labels.records}</h2>
        <div className="flex items-center gap-2">
          <ViewSwitcher view={recordsView} onChange={setRecordsView} />
          <Button onClick={() => openCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            Add {labels.record}
          </Button>
        </div>
      </div>

      {recordsView === 'board' ? (
        <KanbanBoard
          initialRecords={initialRecords}
          stages={stages}
          users={users}
          accountId={accountId}
          recordType={recordType}
          onAddRecord={() => openCreate()}
        />
      ) : recordsView === 'calendar' ? (
        <CalendarView
          accountId={accountId}
          recordType={recordType}
          users={users}
          onAddRecord={(at) => openCreate(at)}
        />
      ) : (
        <ListView
          initialRecords={initialRecords}
          stages={stages}
          users={users}
          accountId={accountId}
          recordType={recordType}
        />
      )}

      <RecordCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        recordType={recordType}
        stages={stages}
        accountId={accountId}
        recordLabel={labels.record}
        scheduledAt={prefillSchedule}
      />
    </div>
  )
}

function ViewSwitcher({
  view,
  onChange,
}: {
  view: 'board' | 'calendar' | 'list'
  onChange: (v: 'board' | 'calendar' | 'list') => void
}) {
  const items = [
    { id: 'board' as const, icon: LayoutGrid, label: 'Board' },
    { id: 'calendar' as const, icon: Calendar, label: 'Calendar' },
    { id: 'list' as const, icon: List, label: 'List' },
  ]

  return (
    <div className="flex rounded-lg border border-stone-200 bg-white p-1">
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
            view === id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}
