'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type DetailSidePanelProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function DetailSidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
}: DetailSidePanelProps) {
  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-stone-200 bg-white shadow-xl',
          className,
        )}
      >
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="border-t border-stone-200 px-5 py-4">{footer}</div>
        ) : null}
      </aside>
    </>
  )
}
