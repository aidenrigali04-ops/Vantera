'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export function AgentConfigPanel({ children, className }: Props) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}
