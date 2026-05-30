'use client'

import {
  CONTACT_TYPE_COLORS,
  CONTACT_TYPE_LABELS,
  avatarColorClass,
  contactInitials,
  formatRelativeTime,
  formatUsdFromCents,
} from '@/lib/contacts/format'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import type { contacts } from '@vantera/db'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { MoreHorizontal, Users } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export type ContactRow = typeof contacts.$inferSelect

type ContactsTableProps = {
  data: ContactRow[]
  isLoading?: boolean
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onArchive: (id: string) => void
  contactLabel: string
  contactsLabel: string
  onAddContact: () => void
  basePath?: string
}

export function ContactsTable({
  data,
  isLoading,
  selectedIds,
  onSelectionChange,
  onArchive,
  contactLabel,
  contactsLabel,
  onAddContact,
  basePath = '/admin/crm/clients',
}: ContactsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo<ColumnDef<ContactRow>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => {
              table.toggleAllPageRowsSelected(!!value)
              onSelectionChange(value ? data.map((r) => r.id) : [])
            }}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            onCheckedChange={(value) => {
              const next = value
                ? [...selectedIds, row.original.id]
                : selectedIds.filter((id) => id !== row.original.id)
              onSelectionChange(next)
              row.toggleSelected(!!value)
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        id: 'avatar',
        header: '',
        cell: ({ row }) => {
          const name = `${row.original.firstName} ${row.original.lastName}`
          return (
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                avatarColorClass(name),
              )}
            >
              {contactInitials(row.original.firstName, row.original.lastName)}
            </span>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'lastName',
        header: 'Name',
        cell: ({ row }) => (
          <Link
            href={`${basePath}/${row.original.id}`}
            className="font-semibold text-stone-900 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.firstName} {row.original.lastName}
          </Link>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={cn('rounded-full', CONTACT_TYPE_COLORS[row.original.type])}
          >
            {CONTACT_TYPE_LABELS[row.original.type] ?? row.original.type}
          </Badge>
        ),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) =>
          row.original.email ? (
            <a href={`mailto:${row.original.email}`} className="text-blue-600 hover:underline">
              {row.original.email}
            </a>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) =>
          row.original.phone ? (
            <a href={`tel:${row.original.phone}`} className="text-stone-700 hover:underline">
              {row.original.phone}
            </a>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'ltvCents',
        header: 'LTV',
        cell: ({ row }) => formatUsdFromCents(row.original.ltvCents),
      },
      {
        accessorKey: 'churnRiskScore',
        header: 'Churn Risk',
        cell: ({ row }) => {
          const score = row.original.churnRiskScore
          return (
            <div className="flex min-w-[100px] items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className={cn('h-full rounded-full', score > 70 ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span className="text-xs text-stone-500">{score}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = row.original.tags ?? []
          const visible = tags.slice(0, 2)
          const overflow = tags.length - visible.length
          return (
            <div className="flex flex-wrap gap-1">
              {visible.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
              {overflow > 0 ? (
                <Badge variant="outline" className="text-[10px]">
                  +{overflow}
                </Badge>
              ) : null}
            </div>
          )
        },
        enableSorting: false,
      },
      {
        accessorKey: 'updatedAt',
        header: 'Last Activity',
        cell: ({ row }) => formatRelativeTime(row.original.updatedAt),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`${basePath}/${row.original.id}`}>View</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(row.original.id)}>Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
      },
    ],
    [basePath, contactLabel, contactsLabel, data, onArchive, onSelectionChange, selectedIds],
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white px-6 py-16 text-center shadow-sm">
        <Users className="mb-4 h-12 w-12 text-stone-300" />
        <h3 className="text-lg font-semibold text-stone-900">No {contactsLabel.toLowerCase()} yet</h3>
        <p className="mt-2 max-w-sm text-sm text-stone-500">
          Add your first {contactLabel.toLowerCase()} to start tracking relationships.
        </p>
        <Button className="mt-6" onClick={onAddContact}>
          Add {contactLabel}
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-stone-500"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer select-none hover:text-stone-800',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
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
                className="cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50"
                onClick={() => {
                  window.location.href = `${basePath}/${row.original.id}`
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
  )
}
