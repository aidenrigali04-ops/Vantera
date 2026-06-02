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
        'fixed bottom-6 left-1/2 z-40 flex max-w-[min(calc(100vw-2rem),960px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-elevated)]/95 px-4 py-3 shadow-[var(--shadow-lg)] backdrop-blur-sm sm:gap-3',
        className,
      )}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <span className="shrink-0 text-[13px] font-medium text-[var(--text-primary)]">
        {label ?? `${count} selected`}
      </span>
      <div className="hidden h-4 w-px bg-[var(--border-default)] sm:block" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:gap-2">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 text-[12px] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]"
      >
        Clear
      </button>
    </div>
  )
}
