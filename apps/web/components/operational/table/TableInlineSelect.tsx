'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

export type InlineSelectOption = {
  value: string
  label: string
}

type TableInlineSelectProps = {
  value: string
  options: InlineSelectOption[]
  onSave: (value: string) => Promise<void>
  disabled?: boolean
  className?: string
  triggerClassName?: string
}

/** Inline table cell editor — click-to-edit without opening a modal. */
export function TableInlineSelect({
  value,
  options,
  onSave,
  disabled,
  className,
  triggerClassName,
}: TableInlineSelectProps) {
  const [pending, setPending] = useState(false)

  async function handleChange(next: string) {
    if (next === value || pending) return
    setPending(true)
    try {
      await onSave(next)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={cn('min-w-[140px]', className)} onClick={(event) => event.stopPropagation()}>
      <Select value={value} onValueChange={handleChange} disabled={disabled || pending}>
        <SelectTrigger
          className={cn(
            'h-8 border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] shadow-none hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
            triggerClassName,
          )}
        >
          {pending ? (
            <span className="flex items-center gap-2 text-[var(--text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Saving…
            </span>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
