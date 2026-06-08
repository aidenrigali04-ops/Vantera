'use client'

import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type AgentTab = {
  id: string
  label: string
  badge?: number | string
  badgeTone?: 'accent' | 'review' | 'neutral'
}

type Breadcrumb = { label: string; href?: string }

type Props = {
  breadcrumbs: Breadcrumb[]
  title: string
  description: string
  reviewBadge?: string
  actions?: ReactNode
  tabs: AgentTab[]
  activeTab: string
  onTabChange: (id: string) => void
  sidebar: ReactNode
  children: ReactNode
}

export function AgentDetailShell({
  breadcrumbs,
  title,
  description,
  reviewBadge,
  actions,
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  children,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="inline-flex items-center gap-1.5">
              {i > 0 ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-[var(--text-primary)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {title}
              </h1>
              {reviewBadge ? (
                <span className="inline-flex items-center rounded-full bg-[var(--danger-muted)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--danger)] ring-1 ring-inset ring-[var(--danger)]/20">
                  {reviewBadge}
                </span>
              ) : null}
            </div>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {description}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div
          className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-1"
          role="tablist"
          aria-label="Agent sections"
        >
          {tabs.map((tab) => {
            const active = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors duration-120 ease',
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge !== 0 && tab.badge !== '0' && tab.badge !== '—' ? (
                  <span
                    className={cn(
                      'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                      tab.badgeTone === 'review'
                        ? 'bg-[var(--danger-muted)] text-[var(--danger)]'
                        : tab.badgeTone === 'accent' || active
                          ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                          : 'bg-[var(--bg-overlay)] text-[var(--text-tertiary)]',
                    )}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="min-w-0">{children}</div>
        <aside className="space-y-4 xl:sticky xl:top-6">{sidebar}</aside>
      </div>
    </div>
  )
}
