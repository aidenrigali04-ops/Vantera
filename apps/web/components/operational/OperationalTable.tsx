'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ReactNode } from 'react'

export type OperationalColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
  sortable?: boolean
  /** Prevent row navigation when interacting with this cell. */
  interactive?: boolean
}

export type OperationalSort = {
  columnId: string
  direction: 'asc' | 'desc'
}

type OperationalTableProps<T extends { id: string }> = {
  columns: OperationalColumn<T>[]
  rows: T[]
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  className?: string
  sort?: OperationalSort | null
  onSortChange?: (sort: OperationalSort | null) => void
  loading?: boolean
  loadingMessage?: string
}

export function OperationalTable<T extends { id: string }>({
  columns,
  rows,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  emptyState,
  className,
  sort,
  onSortChange,
  loading = false,
  loadingMessage = 'Loading…',
}: OperationalTableProps<T>) {
  const allSelected = rows.length > 0 && selectedIds.length === rows.length
  const someSelected = selectedIds.length > 0 && !allSelected

  function toggleAll(checked: boolean) {
    onSelectionChange?.(checked ? rows.map((r) => r.id) : [])
  }

  function toggleRow(id: string, checked: boolean) {
    if (!onSelectionChange) return
    onSelectionChange(
      checked ? [...selectedIds, id] : selectedIds.filter((x) => x !== id),
    )
  }

  function toggleSort(columnId: string) {
    if (!onSortChange) return
    if (sort?.columnId !== columnId) {
      onSortChange({ columnId, direction: 'asc' })
      return
    }
    if (sort.direction === 'asc') {
      onSortChange({ columnId, direction: 'desc' })
      return
    }
    onSortChange(null)
  }

  if (!loading && rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm',
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur-sm">
            <tr className="border-b border-stone-200">
              {onSelectionChange ? (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all rows"
                  />
                </th>
              ) : null}
              {columns.map((col) => {
                const isSorted = sort?.columnId === col.id
                const SortIcon = !isSorted
                  ? ArrowUpDown
                  : sort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown

                return (
                  <th
                    key={col.id}
                    className={cn(
                      'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500',
                      col.className,
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="inline-flex items-center gap-1 transition-colors hover:text-stone-800"
                      >
                        {col.header}
                        <SortIcon className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length + (onSelectionChange ? 1 : 0)}
                  className="px-4 py-10 text-center text-stone-500"
                >
                  {loadingMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'transition-colors duration-150 hover:bg-stone-50/80',
                    onRowClick && 'cursor-pointer',
                    selectedIds.includes(row.id) && 'bg-stone-50',
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {onSelectionChange ? (
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={(v) => toggleRow(row.id, v === true)}
                        aria-label="Select row"
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn('px-4 py-2.5 align-middle', col.className)}
                      onClick={col.interactive ? (event) => event.stopPropagation() : undefined}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
