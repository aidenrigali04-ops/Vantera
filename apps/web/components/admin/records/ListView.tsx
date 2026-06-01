'use client'

import { archiveRecord, updateRecord } from '@/app/(admin)/admin/records/actions'
import { BulkActionBar } from '@/components/operational/BulkActionBar'
import {
  OperationalTable,
  type OperationalColumn,
  type OperationalSort,
} from '@/components/operational/OperationalTable'
import { TableSavedViews } from '@/components/operational/table/TableSavedViews'
import { TableToolbar } from '@/components/operational/table/TableToolbar'
import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { SectionEmptyState } from '@/components/onboarding/SectionEmptyState'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  avatarColorClass,
  contactInitials,
  formatRelativeTime,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import {
  daysBadgeClass,
  daysInStage,
  type RecordWithRelations,
} from '@/lib/records/format'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { PROJECTS_TABLE_VIEWS } from '@/lib/operational/projects-table-views'
import { cn } from '@/lib/utils'
import type { stageDefinitions, users } from '@vantera/db'
import { Archive, ArrowRight, Download, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

type Props = {
  initialRecords: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  onCreateRecord: () => void
}

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
]

const HIGH_VALUE_CENTS = 1_000_000

export function ListView({
  initialRecords,
  stages,
  users,
  onCreateRecord,
}: Props) {
  const router = useRouter()
  const labels = useVerticalLabels()
  const [data, setData] = useState(initialRecords)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [activeViewId, setActiveViewId] = useState('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sort, setSort] = useState<OperationalSort | null>({ columnId: 'updated', direction: 'desc' })
  const [bulkProgress, setBulkProgress] = useState<string | null>(null)

  function applySavedView(viewId: string) {
    setActiveViewId(viewId)
    const view = PROJECTS_TABLE_VIEWS.find((item) => item.id === viewId)
    if (!view) return
    setStageFilter(view.stageId ?? 'all')
    setPriorityFilter(view.priority ?? 'all')
  }

  const filtered = useMemo(() => {
    const view = PROJECTS_TABLE_VIEWS.find((item) => item.id === activeViewId)
    let rows = data.filter((record) => !record.completedAt)

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (record) =>
          record.title.toLowerCase().includes(q) ||
          `${record.contact?.firstName ?? ''} ${record.contact?.lastName ?? ''}`
            .toLowerCase()
            .includes(q),
      )
    }

    if (stageFilter !== 'all') {
      rows = rows.filter((record) => record.stageId === stageFilter)
    }

    if (priorityFilter !== 'all') {
      rows = rows.filter((record) => record.priority === priorityFilter)
    }

    if (view?.overdue) {
      rows = rows.filter(
        (record) =>
          record.scheduledAt && new Date(record.scheduledAt).getTime() < Date.now(),
      )
    }

    if (view?.highValue) {
      rows = rows.filter((record) => record.valueCents >= HIGH_VALUE_CENTS)
    }

    return rows
  }, [activeViewId, data, priorityFilter, search, stageFilter])

  const sortedRows = useMemo(() => {
    if (!sort) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sort.columnId) {
        case 'title':
          av = a.title.toLowerCase()
          bv = b.title.toLowerCase()
          break
        case 'value':
          av = a.valueCents
          bv = b.valueCents
          break
        case 'scheduled':
          av = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
          bv = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
          break
        case 'updated':
          av = new Date(a.updatedAt).getTime()
          bv = new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }
      if (av < bv) return sort.direction === 'asc' ? -1 : 1
      if (av > bv) return sort.direction === 'asc' ? 1 : -1
      return 0
    })
    return copy
  }, [filtered, sort])

  const columns = useMemo<OperationalColumn<RecordWithRelations>[]>(
    () => [
      {
        id: 'title',
        header: labels.record,
        sortable: true,
        cell: (row) => (
          <Link
            href={`/admin/records/${row.id}`}
            className="font-medium text-stone-900 hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.title}
          </Link>
        ),
      },
      {
        id: 'contact',
        header: labels.contact,
        cell: (row) => {
          const contact = row.contact
          if (!contact) return '—'
          const name = `${contact.firstName} ${contact.lastName}`
          return (
            <Link
              href={`/admin/clients/${contact.id}`}
              className="inline-flex items-center gap-2 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px]',
                  avatarColorClass(name),
                )}
              >
                {contactInitials(contact.firstName, contact.lastName)}
              </span>
              {name}
            </Link>
          )
        },
      },
      {
        id: 'stage',
        header: 'Stage',
        cell: (row) => (
          <StatusBadge
            label={row.stage?.label ?? '—'}
            tone={row.stage?.isTerminalWin ? 'success' : row.stage?.isTerminalLoss ? 'danger' : 'info'}
          />
        ),
      },
      {
        id: 'value',
        header: 'Value',
        sortable: true,
        cell: (row) => (
          <span className="font-medium tabular-nums text-stone-800">
            {formatUsdFromCents(row.valueCents)}
          </span>
        ),
      },
      {
        id: 'scheduled',
        header: 'Scheduled',
        sortable: true,
        cell: (row) =>
          row.scheduledAt
            ? new Date(row.scheduledAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : '—',
      },
      {
        id: 'days',
        header: 'Days in stage',
        cell: (row) => {
          const days = daysInStage(row)
          return (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', daysBadgeClass(days))}>
              {days}d
            </span>
          )
        },
      },
      {
        id: 'updated',
        header: 'Last activity',
        sortable: true,
        cell: (row) => (
          <span className="text-stone-500">{formatRelativeTime(row.updatedAt)}</span>
        ),
      },
    ],
    [labels.contact, labels.record],
  )

  async function runBulk(action: (id: string) => Promise<boolean>) {
    let ok = 0
    let fail = 0
    for (let i = 0; i < selectedIds.length; i++) {
      setBulkProgress(`Processing ${i + 1}/${selectedIds.length}…`)
      const success = await action(selectedIds[i]!)
      if (success) ok++
      else fail++
    }
    setBulkProgress(null)
    if (fail > 0) {
      toast.warning(`Updated ${ok}/${selectedIds.length} — ${fail} failed`)
    } else {
      toast.success(`${ok} ${labels.records.toLowerCase()} updated`)
    }
    setSelectedIds([])
  }

  function exportSelected() {
    const rows = data.filter((record) => selectedIds.includes(record.id))
    const header = ['title', 'contact', 'stage', 'value', 'scheduled']
    const lines = rows.map((record) =>
      [
        record.title,
        record.contact ? `${record.contact.firstName} ${record.contact.lastName}` : '',
        record.stage?.label ?? '',
        (record.valueCents / 100).toFixed(0),
        record.scheduledAt ? new Date(record.scheduledAt).toISOString() : '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(','),
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'projects-export.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <TableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setActiveViewId('custom')
        }}
        searchPlaceholder={`Search ${labels.records.toLowerCase()}, ${labels.contacts.toLowerCase()}…`}
        savedViews={
          <TableSavedViews
            views={PROJECTS_TABLE_VIEWS}
            activeViewId={activeViewId}
            onViewChange={applySavedView}
          />
        }
        filters={[
          {
            id: 'stage',
            label: 'Stage',
            value: stageFilter,
            onChange: (value) => {
              setStageFilter(value)
              setActiveViewId('custom')
            },
            options: [
              { value: 'all', label: 'All stages' },
              ...stages.map((stage) => ({ value: stage.id, label: stage.label })),
            ],
            widthClassName: 'w-[168px]',
          },
          {
            id: 'priority',
            label: 'Priority',
            value: priorityFilter,
            onChange: (value) => {
              setPriorityFilter(value)
              setActiveViewId('custom')
            },
            options: PRIORITY_OPTIONS,
            widthClassName: 'w-[148px]',
          },
        ]}
      />

      <OperationalTable
        columns={columns}
        rows={sortedRows}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={(row) => router.push(`/admin/records/${row.id}`)}
        sort={sort}
        onSortChange={setSort}
        emptyState={
          <SectionEmptyState
            title={`No matching ${labels.records.toLowerCase()}`}
            description={`Adjust filters or create a new ${labels.record.toLowerCase()}.`}
            actionLabel={`Create ${labels.record.toLowerCase()}`}
            onAction={onCreateRecord}
          />
        }
      />

      <BulkActionBar
        count={selectedIds.length}
        onClear={() => setSelectedIds([])}
        label={bulkProgress ?? undefined}
      >
        <StageBulkPicker
          stages={stages}
          onSelect={(stageId) =>
            runBulk(async (id) => {
              const result = await updateRecord(id, { stageId })
              if (result.success) {
                setData((prev) =>
                  prev.map((record) =>
                    record.id === id
                      ? {
                          ...record,
                          stageId,
                          stage: stages.find((stage) => stage.id === stageId) ?? record.stage,
                        }
                      : record,
                  ),
                )
              }
              return result.success
            })
          }
        />
        <UserBulkPicker
          userList={users}
          onSelect={(userId) =>
            runBulk(async (id) => {
              const result = await updateRecord(id, { assignedUserId: userId })
              return result.success
            })
          }
        />
        <Button size="sm" variant="secondary" onClick={exportSelected}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            runBulk(async (id) => {
              const result = await archiveRecord(id)
              if (result.success) {
                setData((prev) => prev.filter((record) => record.id !== id))
              }
              return result.success
            })
          }
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" />
          Archive
        </Button>
      </BulkActionBar>
    </div>
  )
}

function StageBulkPicker({
  stages,
  onSelect,
}: {
  stages: (typeof stageDefinitions.$inferSelect)[]
  onSelect: (stageId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary">
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          Move stage
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center">
        {stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-100"
            onClick={() => onSelect(stage.id)}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
            {stage.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function UserBulkPicker({
  userList,
  onSelect,
}: {
  userList: (typeof users.$inferSelect)[]
  onSelect: (userId: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary">
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="center">
        {userList.map((user) => (
          <button
            key={user.id}
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-stone-100"
            onClick={() => onSelect(user.id)}
          >
            {user.fullName}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
