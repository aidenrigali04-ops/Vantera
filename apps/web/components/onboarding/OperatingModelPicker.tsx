'use client'

import {
  OPERATING_MODELS,
  type OperatingModelId,
} from '@/lib/onboarding/operating-models'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

type Props = {
  selected: OperatingModelId
  onSelect: (id: OperatingModelId) => void
  className?: string
}

export function OperatingModelPicker({ selected, onSelect, className }: Props) {
  return (
    <div className={cn('grid gap-2.5 sm:grid-cols-2', className)}>
      {OPERATING_MODELS.map((model) => {
        const Icon = model.icon
        const active = selected === model.id

        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={cn(
              'group relative rounded-lg border p-3 text-left transition-colors duration-[120ms]',
              'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
              active
                ? 'border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-[var(--border-subtle)]"
                style={{ backgroundColor: `${model.accent}14`, color: model.accent }}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              {active ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]">
                  <Check className="h-3 w-3" aria-hidden />
                </span>
              ) : (
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
                  aria-hidden
                />
              )}
            </div>
            <p className="mt-2.5 text-[13px] font-medium leading-snug text-[var(--text-primary)]">
              {model.label}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {model.description}
            </p>
          </button>
        )
      })}
    </div>
  )
}
