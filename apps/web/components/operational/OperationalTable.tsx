'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export type OperationalColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

type OperationalTableProps<T extends { id: string }> = {
  columns: OperationalColumn<T>[]
  rows: T[]
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  className?: string
}

export function OperationalTable<T extends { id: string }>({
  columns,
  rows,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  emptyState,
  className,
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

  if (rows.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-stone-200 bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/80">
              {onSelectionChange ? (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label="Select all rows"
                  />
                </th>
              ) : null}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={cn(
                    'px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-stone-500',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'transition-colors hover:bg-stone-50/80',
                  onRowClick && 'cursor-pointer',
                  selectedIds.includes(row.id) && 'bg-stone-50',
                )}
                onClick={() => onRowClick?.(row)}
              >
                {onSelectionChange ? (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onCheckedChange={(v) => toggleRow(row.id, v === true)}
                      aria-label="Select row"
                    />
                  </td>
                ) : null}
                {columns.map((col) => (
                  <td key={col.id} className={cn('px-4 py-2.5', col.className)}>
                    {col.cell(row)}
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
