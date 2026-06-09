'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Flat section without card chrome (e.g. nested groups) */
  variant?: 'card' | 'plain'
}

export function AgentConfigSection({
  title,
  description,
  action,
  children,
  className,
  variant = 'card',
}: Props) {
  if (variant === 'plain') {
    return (
      <section className={cn('space-y-4', className)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
        <div className="space-y-4">{children}</div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5',
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
