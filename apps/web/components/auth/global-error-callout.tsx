import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type GlobalErrorCalloutProps = {
  message: string
  className?: string
  children?: ReactNode
}

export function GlobalErrorCallout({ message, className, children }: GlobalErrorCalloutProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800',
        className,
      )}
    >
      {message}
      {children}
    </div>
  )
}
