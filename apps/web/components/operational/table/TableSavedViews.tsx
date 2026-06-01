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
      <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400">
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
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors duration-150',
              active
                ? 'bg-stone-900 text-white'
                : 'bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 hover:text-stone-900',
            )}
          >
            {view.label}
          </button>
        )
      })}
      <button
        type="button"
        disabled
        className="rounded-full px-3 py-1 text-[12px] font-medium text-stone-400 ring-1 ring-dashed ring-stone-200"
        title="Custom saved views coming soon"
      >
        + Save view
      </button>
    </div>
  )
}
