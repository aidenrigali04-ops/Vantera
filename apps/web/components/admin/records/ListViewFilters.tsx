'use client'

import { Input } from '@/components/ui/input'
import type { stageDefinitions, users } from '@vantera/db'
import { useEffect, useState } from 'react'

type Props = {
  filters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
  stages: (typeof stageDefinitions.$inferSelect)[]
  users: (typeof users.$inferSelect)[]
}

export function ListViewFilters({ filters, onChange, stages, users }: Props) {
  const [search, setSearch] = useState(filters.search ?? '')

  useEffect(() => {
    const t = setTimeout(() => {
      onChange({ ...filters, search })
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  const setFilter = (key: string, value: string) => {
    onChange({ ...filters, [key]: value })
  }

  const clearFilter = (key: string) => {
    const next = { ...filters }
    delete next[key]
    onChange(next)
  }

  const activeEntries = Object.entries(filters).filter(([k, v]) => v && k !== 'search')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search title or contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="rounded-md border border-stone-200 px-2 py-2 text-sm"
          value={filters.stage ?? ''}
          onChange={(e) => setFilter('stage', e.target.value)}
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-stone-200 px-2 py-2 text-sm"
          value={filters.priority ?? ''}
          onChange={(e) => setFilter('priority', e.target.value)}
        >
          <option value="">All priorities</option>
          {['urgent', 'high', 'normal', 'low'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-stone-200 px-2 py-2 text-sm"
          value={filters.assignedUser ?? ''}
          onChange={(e) => setFilter('assignedUser', e.target.value)}
        >
          <option value="">All assignees</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName}
            </option>
          ))}
        </select>
      </div>

      {activeEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeEntries.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-stone-700"
            >
              {key}: {value}
              <button type="button" onClick={() => clearFilter(key)}>
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className="text-stone-500 underline"
            onClick={() => onChange({ search: filters.search ?? '' })}
          >
            Clear all filters
          </button>
        </div>
      ) : null}
    </div>
  )
}
