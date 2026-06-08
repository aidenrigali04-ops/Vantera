'use client'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Props = {
  id: string
  label: string
  hint?: string
  children: ReactNode
  className?: string
}

export function AgentFormField({ id, label, hint, children, className }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="agent-label">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{hint}</p>
      ) : null}
    </div>
  )
}

/** Shared input classNames for agent workspace controls */
export const agentInputClassName =
  'agent-input h-10 border-[var(--border-default)] bg-[var(--bg-surface)] text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]'

export const agentTextareaClassName =
  'agent-input min-h-[120px] resize-y border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]'

export const agentSelectTriggerClassName =
  'agent-input h-10 border-[var(--border-default)] bg-[var(--bg-surface)] text-[15px] text-[var(--text-primary)]'
