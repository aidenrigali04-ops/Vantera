'use client'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

export type TableFilterDef = {
  id: string
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  widthClassName?: string
}

type TableToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: TableFilterDef[]
  savedViews?: ReactNode
  trailing?: ReactNode
  className?: string
}

/** Search + dropdown filters + saved view slot — shared table chrome. */
export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  savedViews,
  trailing,
  className,
}: TableToolbarProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {savedViews ? <div>{savedViews}</div> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-stone-200 bg-white pl-9 text-[13px] shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.length > 0 ? (
            <span className="hidden items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-stone-400 sm:inline-flex">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters
            </span>
          ) : null}
          {filters.map((filter) => (
            <Select key={filter.id} value={filter.value} onValueChange={filter.onChange}>
              <SelectTrigger
                className={cn(
                  'h-9 border-stone-200 bg-white text-[13px] shadow-sm',
                  filter.widthClassName ?? 'w-[160px]',
                )}
              >
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {trailing}
        </div>
      </div>
    </div>
  )
}
