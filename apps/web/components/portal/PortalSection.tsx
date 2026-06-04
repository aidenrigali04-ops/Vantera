import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type PortalSectionProps = {
  title: string
  subtitle?: string
  action?: { label: string; href: string }
  children: ReactNode
  className?: string
}

export function PortalSection({
  title,
  subtitle,
  action,
  children,
  className,
}: PortalSectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 text-[13px] font-medium text-[var(--accent)] underline-offset-2 transition-colors duration-120 ease hover:text-[var(--accent-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}
