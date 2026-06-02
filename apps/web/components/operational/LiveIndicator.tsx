'use client'

import { cn } from '@/lib/utils'

type Props = {
  active: boolean
  className?: string
}

export function LiveIndicator({ active, className }: Props) {
  if (!active) return null

  return (
    <span
      className={cn(
        'status-pill status-active inline-flex items-center gap-1.5',
        className,
      )}
      title="Updates in real time"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--success)] motion-safe:animate-pulse"
        aria-hidden
      />
      Live
    </span>
  )
}
