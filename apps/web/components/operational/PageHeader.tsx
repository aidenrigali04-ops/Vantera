import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  actions?: ReactNode
  filters?: ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, filters, className }: PageHeaderProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-stone-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {filters ? <div>{filters}</div> : null}
    </div>
  )
}
