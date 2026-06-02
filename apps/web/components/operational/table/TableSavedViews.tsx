'use client'

import { cn } from '@/lib/utils'

export type SavedViewItem = {
  id: string
  label: string
  description?: string
}

type TableSavedViewsProps = {
  views: SavedViewItem[]
  activeViewId: string
  onViewChange: (viewId: string) => void
  className?: string
}

/** Horizontal saved-view switcher — preset views now; custom views later. */
export function TableSavedViews({
  views,
  activeViewId,
  onViewChange,
  className,
}: TableSavedViewsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        Views
      </span>
      {views.map((view) => {
        const active = view.id === activeViewId
        return (
          <button
            key={view.id}
            type="button"
            title={view.description}
            onClick={() => onViewChange(view.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]',
              active
                ? 'border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--text-primary)]'
                : 'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
            )}
          >
            {view.label}
          </button>
        )
      })}
      <button
        type="button"
        disabled
        className="rounded-md border border-dashed border-[var(--border-default)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-disabled)]"
        title="Custom saved views coming soon"
      >
        + Save view
      </button>
    </div>
  )
}
