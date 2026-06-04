'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  isAutomaticOutreachMode,
  OUTREACH_AUTOMATION_LABELS,
  type OutreachAutomationMode,
} from '@/lib/sdr/outreach-automation-mode'

type Props = {
  value: OutreachAutomationMode
  onChange: (mode: OutreachAutomationMode) => void
  disabled?: boolean
  /** @deprecated Layout is always compact switch row */
  compact?: boolean
}

export function SdrOutreachAutomationToggle({ value, onChange, disabled }: Props) {
  const automatic = isAutomaticOutreachMode(value)

  function handleCheckedChange(checked: boolean) {
    onChange(checked ? 'automatic' : 'review')
  }

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3.5',
        disabled && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {OUTREACH_AUTOMATION_LABELS.automatic} pipeline
          </p>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-medium',
              automatic
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]',
            )}
          >
            {automatic ? 'On' : 'Off — manual review'}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {automatic
            ? 'Scout pulls leads daily at 8:00 AM, Message Drafter personalizes copy, and Outreach Agent launches campaigns without approval.'
            : 'Scout and Drafter still run, but you approve email and SMS in Message Drafter or run the Outreach Agent queue yourself.'}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-1.5 pt-0.5">
        <Switch
          id="outreach-automation-toggle"
          checked={automatic}
          onCheckedChange={handleCheckedChange}
          disabled={disabled}
          aria-label={`${OUTREACH_AUTOMATION_LABELS.automatic} pipeline ${automatic ? 'on' : 'off'}`}
          className="data-[state=checked]:bg-[var(--text-primary)] data-[state=unchecked]:bg-[var(--border-strong)]"
        />
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {automatic ? 'Auto' : 'Manual'}
        </span>
      </div>
    </div>
  )
}
