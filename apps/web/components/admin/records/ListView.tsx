'use client'

import { archiveRecord } from '@/app/(admin)/admin/records/actions'
import { BulkActionBar } from '@/components/admin/records/BulkActionBar'
import { ListViewFilters } from '@/components/admin/records/ListViewFilters'
import { SavedViews } from '@/components/admin/records/SavedViews'
import {
  avatarColorClass,
  contactInitials,
  formatRelativeTime,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import {
  daysBadgeClass,
  daysInStage,
  priorityBorderClass,
  type RecordWithRelations,
} from '@/lib/records/format'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import type { stageDefinitions, users } from '@vantera/db'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

type Props = {
  initialRecords: RecordWithRelations[]
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
  accountId: string
  recordType: string
}

export function ListView({ initialRecords, stages, users, accountId }: Props) {
  const labels = useVerticalLabels()
  const { selectedRecordIds, setSelectedRecordIds, clearSelection } = useUIStore()
  const [sorting, setSorting] = useState<SortingState>([])
  const [data, setData] = useState(initialRecords)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    let rows = data
    if (filters.search) {
      const q = filters.search.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          `${r.contact?.firstName ?? ''} ${r.contact?.lastName ?? ''}`.toLowerCase().includes(q),
      )
    }
    if (filters.stage) {
      rows = rows.filter((r) => r.stageId === filters.stage)
    }
    if (filters.priority) {
      rows = rows.filter((r) => r.priority === filters.priority)
    }
    return rows
  }, [data, filters])

  const columns = useMemo<ColumnDef<RecordWithRelations>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) =>
              setSelectedRecordIds(v ? filtered.map((r) => r.id) : [])
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedRecordIds.includes(row.original.id)}
            onCheckedChange={(v) => {
              setSelectedRecordIds(
                v
                  ? [...selectedRecordIds, row.original.id]
                  : selectedRecordIds.filter((id) => id !== row.original.id),
              )
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: 'title',
        header: 'Record',
        cell: ({ row }) => (
          <Link href={`/admin/records/${row.original.id}`} className="font-semibold hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: ({ row }) => {
          const c = row.original.contact
          if (!c) return '—'
          const name = `${c.firstName} ${c.lastName}`
          return (
            <Link href={`/admin/clients/${c.id}`} className="inline-flex items-center gap-2 hover:underline">
              <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px]', avatarColorClass(name))}>
                {contactInitials(c.firstName, c.lastName)}
              </span>
              {name}
            </Link>
          )
        },
      },
      {
        id: 'stage',
        header: 'Stage',
        cell: ({ row }) => (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: row.original.stage?.color ?? '#64748B' }}
          >
            {row.original.stage?.label ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'valueCents',
        header: 'Value',
        cell: ({ row }) => formatUsdFromCents(row.original.valueCents),
      },
      {
        accessorKey: 'scheduledAt',
        header: 'Scheduled',
        cell: ({ row }) =>
          row.original.scheduledAt
            ? new Date(row.original.scheduledAt).toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
            : '—',
      },
      {
        id: 'days',
        header: 'Days',
        cell: ({ row }) => {
          const d = daysInStage(row.original)
          return (
            <span className={cn('rounded-full px-2 py-0.5 text-xs', daysBadgeClass(d))}>{d}d</span>
          )
        },
      },
      {
        accessorKey: 'updatedAt',
        header: 'Last activity',
        cell: ({ row }) => formatRelativeTime(row.original.updatedAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/admin/records/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const result = await archiveRecord(row.original.id)
                  if (result.success) {
                    setData((prev) => prev.filter((r) => r.id !== row.original.id))
                    toast.success('Archived')
                  }
                }}
              >
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [filtered, selectedRecordIds, setSelectedRecordIds],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="space-y-4">
      <SavedViews accountId={accountId} recordsLabel={labels.records} />
      <ListViewFilters filters={filters} onChange={setFilters} stages={stages} users={users} />
      <p className="text-sm text-stone-500">
        {filtered.length} {labels.records.toLowerCase()}
      </p>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-medium uppercase text-stone-500">
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp className="h-3 w-3" />,
                            desc: <ChevronDown className="h-3 w-3" />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-stone-100 hover:bg-stone-50',
                    priorityBorderClass(row.original.priority),
                    selectedRecordIds.includes(row.original.id) && 'bg-blue-50',
                  )}
                  onClick={() => {
                    const id = row.original.id
                    setSelectedRecordIds(
                      selectedRecordIds.includes(id)
                        ? selectedRecordIds.filter((x) => x !== id)
                        : [...selectedRecordIds, id],
                    )
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BulkActionBar
        selectedIds={selectedRecordIds}
        stages={stages}
        users={users}
        recordsLabel={labels.records}
        onClear={clearSelection}
        onComplete={(updated) => {
          setData(updated)
          clearSelection()
        }}
        allRecords={data}
      />
    </div>
  )
}
