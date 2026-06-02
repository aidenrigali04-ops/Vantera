'use client'

import { cn } from '@/lib/utils'
import type { OutreachAutomationMode } from '@/lib/sdr/outreach-automation'
import { OUTREACH_AUTOMATION_LABELS } from '@/lib/sdr/outreach-automation'
import { Check, Zap } from 'lucide-react'

type Props = {
  value: OutreachAutomationMode
  onChange: (mode: OutreachAutomationMode) => void
  disabled?: boolean
  compact?: boolean
}

const OPTIONS: Array<{
  id: OutreachAutomationMode
  title: string
  description: string
  icon: typeof Check
}> = [
  {
    id: 'review',
    title: OUTREACH_AUTOMATION_LABELS.review,
    description:
      'Prospect Scout finds leads, Message Drafter writes a 5-step sequence, and you approve each send in Message Drafter.',
    icon: Check,
  },
  {
    id: 'automatic',
    title: OUTREACH_AUTOMATION_LABELS.automatic,
    description:
      'Same pipeline — leads are discovered, sequences are drafted with Anthropic, and due email/SMS sends run on your schedule automatically.',
    icon: Zap,
  },
]

export function SdrOutreachAutomationToggle({ value, onChange, disabled, compact }: Props) {
  return (
    <div className={cn('grid gap-2', compact ? 'sm:grid-cols-2' : 'gap-3')}>
      {OPTIONS.map((option) => {
        const active = value === option.id
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
              active
                ? 'border-[var(--accent-border)] bg-[var(--accent-muted)]'
                : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
                  active
                    ? 'border-[var(--accent-border)] bg-[var(--bg-surface)]'
                    : 'border-[var(--border-subtle)]',
                )}
              >
                <Icon className="h-4 w-4 text-[var(--accent)]" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--text-primary)]">
                  {option.title}
                </span>
                <span className="mt-1 block text-[12px] leading-relaxed text-[var(--text-secondary)]">
                  {option.description}
                </span>
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
