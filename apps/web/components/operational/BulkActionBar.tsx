'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type BulkActionBarProps = {
  count: number
  onClear: () => void
  children: ReactNode
  className?: string
}

export function BulkActionBar({ count, onClear, children, className }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-lg',
        className,
      )}
    >
      <span className="text-sm font-medium text-stone-700">{count} selected</span>
      <div className="h-4 w-px bg-stone-200" />
      <div className="flex items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-1 text-xs text-stone-500 hover:text-stone-800"
      >
        Clear
      </button>
    </div>
  )
}
