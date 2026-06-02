'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export type OnboardingChoiceOption = {
  value: string
  label: string
  description?: string
}

type Props = {
  options: OnboardingChoiceOption[]
  selected: string | null
  onSelect: (value: string) => void
  className?: string
}

/** Compact text-only multiple choice — wide rows, short height, no icons. */
export function OnboardingChoiceList({ options, selected, onSelect, className }: Props) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {options.map((option) => {
        const active = selected === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              'flex w-full items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-left',
              'transition-colors duration-[120ms]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
              active
                ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                {option.label}
              </span>
              {option.description ? (
                <span className="mt-0.5 block truncate text-[12px] text-[var(--text-secondary)]">
                  {option.description}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--text-inverse)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-subtle)]',
              )}
              aria-hidden
            >
              {active ? <Check className="h-3 w-3" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
