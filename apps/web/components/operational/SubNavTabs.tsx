'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'

export type SubNavTab = {
  href: string
  label: string
}

type SubNavTabsProps = {
  tabs: readonly SubNavTab[]
  activePath: string
  ariaLabel: string
  className?: string
}

/** Shared horizontal tab nav — token-based, used by intelligence and outreach sections. */
export function SubNavTabs({ tabs, activePath, ariaLabel, className }: SubNavTabsProps) {
  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-[var(--border-default)] pb-px',
        className,
      )}
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = activePath === tab.href || activePath.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-muted)]',
              active
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
