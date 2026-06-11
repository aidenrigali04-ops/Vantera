import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type DashboardSectionProps = {
  title: string
  subtitle?: string
  action?: { label: string; href: string }
  children: ReactNode
  className?: string
  id?: string
  tourAnchor?: string
}

/** Shared section shell — calm enterprise card with optional header action. */
export function DashboardSection({
  title,
  subtitle,
  action,
  children,
  className,
  id,
  tourAnchor,
}: DashboardSectionProps) {
  return (
    <section
      id={id}
      data-tour={tourAnchor}
      className={cn(
        'rounded-xl border border-[var(--border-default)] bg-white shadow-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-tertiary)]">{subtitle}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-[13px] font-medium text-[var(--text-secondary)] underline-offset-2 transition-colors hover:text-[var(--text-primary)] hover:underline"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
