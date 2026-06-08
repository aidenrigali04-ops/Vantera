'use client'

import { StatusBadge } from '@/components/operational/table/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Clock, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type StatusTone = 'success' | 'warning' | 'neutral' | 'info'

type MenuItem = { label: string; href?: string; onClick?: () => void }

type Props = {
  title: string
  description: string
  statusLabel: string
  statusTone: StatusTone
  schedule?: string
  stepsLabel?: string
  lastRun?: string
  pendingLabel?: string
  href?: string
  menuItems?: MenuItem[]
  footerExtra?: ReactNode
  className?: string
}

export function AgentScenarioCard({
  title,
  description,
  statusLabel,
  statusTone,
  schedule,
  stepsLabel,
  lastRun,
  pendingLabel,
  href,
  menuItems,
  footerExtra,
  className,
}: Props) {
  const card = (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-120 ease',
        href && 'hover:border-[var(--border-default)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
              {title}
            </h3>
            <StatusBadge label={statusLabel} tone={statusTone} />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">{description}</p>
        </div>
        {menuItems && menuItems.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-[var(--text-tertiary)]">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                <span className="sr-only">Scenario actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems.map((item) =>
                item.href ? (
                  <DropdownMenuItem key={item.label} asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={item.label} onClick={item.onClick}>
                    {item.label}
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {(schedule || stepsLabel || lastRun || pendingLabel || footerExtra) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/40 px-5 py-3 text-[12px] text-[var(--text-secondary)]">
          {schedule ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[var(--text-tertiary)]" aria-hidden />
              {schedule}
            </span>
          ) : null}
          {stepsLabel ? <span>{stepsLabel}</span> : null}
          {lastRun ? <span>{lastRun}</span> : null}
          {pendingLabel ? (
            <span className="font-medium text-[var(--danger)]">{pendingLabel}</span>
          ) : null}
          {footerExtra}
        </div>
      ) : null}
    </article>
  )

  if (href) {
    return (
      <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)]">
        {card}
      </Link>
    )
  }

  return card
}
