'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type BulkActionBarProps = {
  count: number
  onClear: () => void
  children: ReactNode
  className?: string
  label?: string
}

/** Floating bulk-action toolbar — appears when rows are selected. */
export function BulkActionBar({
  count,
  onClear,
  children,
  className,
  label,
}: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={cn(
        'fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-4',
        className,
      )}
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <span className="text-[13px] font-medium text-stone-800">
        {label ?? `${count} selected`}
      </span>
      <div className="hidden h-4 w-px bg-stone-200 sm:block" />
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-[12px] font-medium text-stone-500 transition-colors hover:text-stone-900 sm:ml-1"
      >
        Clear
      </button>
    </div>
  )
}
