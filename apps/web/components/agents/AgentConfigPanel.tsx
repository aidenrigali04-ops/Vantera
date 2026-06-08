'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function AgentConfigPanel({ children, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-sm)] md:p-8',
        className,
      )}
    >
      <div className="space-y-8">{children}</div>
    </div>
  )
}
