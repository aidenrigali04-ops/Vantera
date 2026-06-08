'use client'

import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function AgentCapabilityCard({
  icon: Icon,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
}: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4 transition-colors duration-[120ms]',
        checked && !disabled && 'border-[var(--accent-border)] bg-[var(--accent-muted)]/20',
        disabled && 'opacity-50',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--accent)] shadow-[var(--shadow-sm)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={title}
        className="agent-switch data-[state=checked]:bg-[var(--accent)]"
      />
    </div>
  )
}
