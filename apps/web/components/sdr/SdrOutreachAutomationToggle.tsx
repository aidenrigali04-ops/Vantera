'use client'

import { cn } from '@/lib/utils'
import {
  OUTREACH_AUTOMATION_LABELS,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'
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
      'Prospect Scout and Pipeline Analyst still run on schedule. Sequences are drafted for you, but email/SMS sends and Outreach Agent queue runs require approval in Message Drafter or manual Run queue.',
    icon: Check,
  },
  {
    id: 'automatic',
    title: OUTREACH_AUTOMATION_LABELS.automatic,
    description:
      'Full autopilot: Scout discovery, 5-step sequences, due SDR sends, and linked Outreach Agent campaigns all process on your outreach window without manual steps.',
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
