'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type SavedView = {
  id: string
  name: string
  filters: Record<string, string>
}

const DEFAULT_VIEWS = (recordsLabel: string): SavedView[] => [
  { id: 'all', name: `All ${recordsLabel}`, filters: {} },
  { id: 'high-value', name: 'High-value', filters: { sortBy: 'valueCents', sortDir: 'desc' } },
  { id: 'unassigned', name: 'Unassigned', filters: { assignedUser: '' } },
]

type Props = {
  accountId: string
  recordsLabel: string
  activeViewId?: string
  onSelectView?: (view: SavedView) => void
}

export function SavedViews({ accountId, recordsLabel, activeViewId = 'all', onSelectView }: Props) {
  const storageKey = `ventaro_saved_views_${accountId}`
  const [customViews, setCustomViews] = useState<SavedView[]>([])
  const [active, setActive] = useState(activeViewId)
  const [saveOpen, setSaveOpen] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setCustomViews(JSON.parse(raw) as SavedView[])
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const views = [...DEFAULT_VIEWS(recordsLabel), ...customViews]

  const select = (view: SavedView) => {
    setActive(view.id)
    onSelectView?.(view)
  }

  const saveView = () => {
    if (!newName.trim()) return
    const view: SavedView = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      filters: {},
    }
    const next = [...customViews, view]
    setCustomViews(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    setNewName('')
    setSaveOpen(false)
    select(view)
  }

  const removeView = (id: string) => {
    const next = customViews.filter((v) => v.id !== id)
    setCustomViews(next)
    localStorage.setItem(storageKey, JSON.stringify(next))
    if (active === id) setActive('all')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => select(view)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            active === view.id
              ? 'bg-stone-900 text-white'
              : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
          )}
        >
          {view.name}
          {view.id.startsWith('custom-') ? (
            <span
              role="button"
              tabIndex={0}
              className="ml-1 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                removeView(view.id)
              }}
            >
              ×
            </span>
          ) : null}
        </button>
      ))}

      <Popover open={saveOpen} onOpenChange={setSaveOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Save current view
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2">
          <Input
            placeholder="View name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button size="sm" onClick={saveView}>
            Save
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
