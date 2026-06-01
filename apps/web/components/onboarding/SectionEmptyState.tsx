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
        'rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? <Icon className="mx-auto mb-3 h-8 w-8 text-stone-300" aria-hidden /> : null}
      <p className="text-sm font-medium text-stone-800">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-500">{description}</p>
      <Button type="button" size="sm" className="mt-5" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  )
}
