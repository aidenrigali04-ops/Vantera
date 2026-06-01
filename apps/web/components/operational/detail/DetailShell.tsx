'use client'

import { formatRelativeTime } from '@/lib/contacts/format'
import { cn } from '@/lib/utils'
import { ArrowLeft, Brain, GitMerge, Sparkles, Zap, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type DetailShellProps = {
  children: ReactNode
  className?: string
}

export function DetailShell({ children, className }: DetailShellProps) {
  return <div className={cn('space-y-6', className)}>{children}</div>
}

type DetailBackLinkProps = {
  href: string
  label: string
}

export function DetailBackLink({ href, label }: DetailBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-[13px] font-medium text-stone-500 transition-colors hover:text-stone-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  )
}

type DetailHeaderProps = {
  eyebrow?: string
  title: string
  subtitle?: string
  badges?: ReactNode
  actions?: ReactNode
  avatar?: ReactNode
}

export function DetailHeader({
  eyebrow = 'Detail',
  title,
  subtitle,
  badges,
  actions,
  avatar,
}: DetailHeaderProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {avatar}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-stone-900 sm:text-2xl">
              {title}
            </h1>
            {subtitle ? <p className="mt-1 text-[13px] text-stone-500">{subtitle}</p> : null}
            {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

type DetailLayoutProps = {
  main: ReactNode
  aside?: ReactNode
}

export function DetailLayout({ main, aside }: DetailLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-6">{main}</div>
      {aside ? <aside className="space-y-6 lg:sticky lg:top-6">{aside}</aside> : null}
    </div>
  )
}

type DetailSectionProps = {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function DetailSection({ title, subtitle, action, children, className }: DetailSectionProps) {
  return (
    <section className={cn('rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6', className)}>
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-stone-500">
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="mt-1 text-[13px] text-stone-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export type DetailTimelineItem = {
  id: string
  body?: string | null
  activityType: string
  createdAt: Date | string
  actorType?: string | null
}

type DetailTimelineProps = {
  items: DetailTimelineItem[]
  emptyTitle?: string
  emptyDescription?: string
}

function timelineIcon(item: DetailTimelineItem): LucideIcon {
  if (item.actorType === 'automation') return GitMerge
  if (item.actorType === 'system') return Zap
  if (item.activityType.includes('agent')) return Brain
  if (item.activityType.includes('note')) return Sparkles
  return Zap
}

export function DetailTimeline({
  items,
  emptyTitle = 'No activity yet',
  emptyDescription = 'Updates, notes, and system events will appear here as work progresses.',
}: DetailTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center">
        <p className="text-sm font-medium text-stone-800">{emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-stone-500">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const Icon = timelineIcon(item)
        return (
          <li key={item.id} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100">
              <Icon className="h-4 w-4 text-stone-600" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] leading-relaxed text-stone-800">
                {item.body ?? item.activityType.replace(/_/g, ' ')}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">{formatRelativeTime(item.createdAt)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

type DetailFieldProps = {
  label: string
  value?: string | null
  children?: ReactNode
}

export function DetailField({ label, value, children }: DetailFieldProps) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500">{label}</p>
      <div className="mt-1 text-[13px] text-stone-900">{children ?? value ?? '—'}</div>
    </div>
  )
}

export function DetailFieldGrid({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</div>
}

type DetailMetaItem = {
  label: string
  value: ReactNode
}

type DetailMetaPanelProps = {
  title?: string
  items: DetailMetaItem[]
}

export function DetailMetaPanel({ title = 'Details', items }: DetailMetaPanelProps) {
  return (
    <DetailSection title={title}>
      <dl className="space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-stone-500">
              {item.label}
            </dt>
            <dd className="mt-1 text-[13px] text-stone-900">{item.value}</dd>
          </div>
        ))}
      </dl>
    </DetailSection>
  )
}
