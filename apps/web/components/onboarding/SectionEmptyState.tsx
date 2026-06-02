'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type Props = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  icon?: LucideIcon
  className?: string
}

/** Calm, directive empty state — always includes one clear next step. */
export function SectionEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <Icon className="mx-auto mb-3 h-8 w-8 text-[var(--text-disabled)]" aria-hidden />
      ) : null}
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      <Button
        type="button"
        size="sm"
        className="mt-5 bg-[var(--text-primary)] text-[var(--text-inverse)] hover:opacity-90"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  )
}
