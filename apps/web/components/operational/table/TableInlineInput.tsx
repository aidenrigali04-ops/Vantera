'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type TableInlineInputProps = {
  value: string | null
  onSave: (value: string) => Promise<void>
  placeholder?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  type?: 'text' | 'email'
}

/** Inline table cell editor — click to edit, blur or Enter to save. */
export function TableInlineInput({
  value,
  onSave,
  placeholder = 'Add email…',
  disabled,
  className,
  inputClassName,
  type = 'text',
}: TableInlineInputProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [value, editing])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function commit() {
    const trimmed = draft.trim()
    const current = (value ?? '').trim()
    if (trimmed === current) {
      setEditing(false)
      return
    }

    setPending(true)
    try {
      await onSave(trimmed)
      setEditing(false)
    } finally {
      setPending(false)
    }
  }

  if (editing) {
    return (
      <div className={cn('min-w-[160px]', className)} onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          disabled={pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commit()
            }
            if (event.key === 'Escape') {
              setDraft(value ?? '')
              setEditing(false)
            }
          }}
          onBlur={() => void commit()}
          className={cn(
            'h-8 w-full rounded-md border border-stone-200 bg-white px-2 text-[13px] text-stone-900 shadow-none outline-none ring-stone-900/10 focus:ring-2',
            inputClassName,
          )}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
      className={cn(
        'group flex min-w-[160px] items-center gap-2 text-left text-[13px]',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      {pending ? (
        <span className="flex items-center gap-2 text-stone-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Saving…
        </span>
      ) : value ? (
        <span className="truncate text-blue-600 group-hover:underline">{value}</span>
      ) : (
        <span className="text-stone-400 group-hover:text-stone-600">{placeholder}</span>
      )}
    </button>
  )
}
