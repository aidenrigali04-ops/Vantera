'use client'

import { KanbanBoard } from '@/components/admin/records/KanbanBoard'
import { CalendarView } from '@/components/admin/records/CalendarView'
import { ListView } from '@/components/admin/records/ListView'
import { RecordCreateSheet } from '@/components/admin/records/RecordCreateSheet'
import { PageHeader } from '@/components/operational/PageHeader'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import type { RecordWithRelations } from '@/lib/records/format'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { stageDefinitions, users } from '@vantera/db'
import { Calendar, FolderKanban, LayoutGrid, List, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

type Props = {
  initialRecords: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  recordType: string
  accountId: string
  setupMode?: boolean
  initialContactId?: string
  kpiStrip: ReactNode
}

export function RecordsPageClient({
  initialRecords,
  stages,
  users,
  recordType,
  accountId,
  setupMode = false,
  initialContactId,
  kpiStrip,
}: Props) {
  const labels = useVerticalLabels()
  const { recordsView, setRecordsView } = useUIStore()
  const [createOpen, setCreateOpen] = useState(Boolean(initialContactId))
  const [prefillSchedule, setPrefillSchedule] = useState<string | undefined>()

  useEffect(() => {
    if (initialContactId) {
      setCreateOpen(true)
    }
  }, [initialContactId])

  const isEmpty = initialRecords.length === 0

  const openCreate = (scheduledAt?: Date) => {
    setPrefillSchedule(scheduledAt?.toISOString())
    setCreateOpen(true)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={labels.records}
        description={`Active client delivery — track ${labels.records.toLowerCase()}, stages, and team workload in one operational view.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher view={recordsView} onChange={setRecordsView} />
            <Button onClick={() => openCreate()} className="bg-stone-900 hover:bg-stone-800">
              <Plus className="mr-2 h-4 w-4" />
              Add {labels.record.toLowerCase()}
            </Button>
          </div>
        }
      />

      {kpiStrip}

      {isEmpty ? (
        <SectionEmptyState
          icon={FolderKanban}
          title={`No ${labels.records.toLowerCase()} yet`}
          description={
            setupMode
              ? `No ${labels.records.toLowerCase()} yet. ${labels.records} manage your active client work — create one to connect delivery to your clients.`
              : `${labels.records} track active client work from kickoff through completion.`
          }
          actionLabel={`Create ${labels.record.toLowerCase()}`}
          onAction={() => openCreate()}
        />
      ) : recordsView === 'board' ? (
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
          onCreateRecord={() => openCreate()}
        />
      )}

      <RecordCreateSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        recordType={recordType}
        stages={stages}
        accountId={accountId}
        recordLabel={labels.record}
        contactId={initialContactId}
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
    <div className="flex rounded-lg border border-stone-200 bg-white p-1 shadow-sm">
      {items.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition-colors',
            view === id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
