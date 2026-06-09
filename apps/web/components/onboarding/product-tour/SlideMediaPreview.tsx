'use client'

import type { ProductTourPreviewId } from '@/lib/onboarding/product-tour'
import { cn } from '@/lib/utils'
import {
  Brain,
  CheckCircle2,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Sparkles,
  Users,
} from 'lucide-react'

import type { JSX, ReactNode } from 'react'

function MockChrome({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] shadow-[var(--shadow-md)]',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
        <span className="size-2 rounded-full bg-[#ff5f57]" />
        <span className="size-2 rounded-full bg-[#febc2e]" />
        <span className="size-2 rounded-full bg-[#28c840]" />
      </div>
      {children}
    </div>
  )
}

function PreviewWelcome() {
  return (
    <MockChrome>
      <div className="flex h-[220px]">
        <div className="w-16 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2">
          {[LayoutDashboard, Users, Handshake, FolderKanban].map((Icon, i) => (
            <div
              key={i}
              className={cn(
                'mb-1 flex h-7 items-center justify-center rounded-md',
                i === 0 ? 'bg-[var(--brand-accent-muted)] text-[var(--brand-accent)]' : 'text-[var(--text-tertiary)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          ))}
        </div>
        <div className="flex-1 p-3">
          <div className="mb-3 h-3 w-32 rounded bg-[var(--bg-overlay)]" />
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-[var(--shadow-sm)]">
            <div className="mb-2 h-2.5 w-24 rounded bg-[var(--text-primary)]/80" />
            <div className="space-y-2">
              <div className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)]" />
              <div className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)]" />
            </div>
          </div>
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewPriorities() {
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">Today&apos;s priorities</span>
          <span className="rounded-full bg-[var(--bg-overlay)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
            3 items
          </span>
        </div>
        {[
          { accent: 'border-l-[var(--danger)]', label: 'Overdue task — Q2 proposal' },
          { accent: 'border-l-[var(--warning)]', label: 'Stalled deal — Acme renewal' },
          { accent: 'border-l-[var(--brand-accent)]', label: 'Reply detected — Nova Labs' },
        ].map((row) => (
          <div
            key={row.label}
            className={cn(
              'rounded-md border border-[var(--border-default)] border-l-[3px] bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-[var(--text-primary)]',
              row.accent,
            )}
          >
            {row.label}
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

function PreviewNavigation() {
  const items = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Users, label: 'Clients' },
    { icon: Handshake, label: 'Pipeline' },
    { icon: FolderKanban, label: 'Projects' },
  ]

  return (
    <MockChrome className="max-w-[280px]">
      <div className="bg-[var(--bg-surface)] p-3">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Go to
        </p>
        <ul className="space-y-1">
          {items.map(({ icon: Icon, label, active }) => (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px]',
                active
                  ? 'bg-[var(--brand-accent-muted)] font-medium text-[var(--text-primary)] ring-1 ring-[var(--brand-accent-border)]'
                  : 'text-[var(--text-secondary)]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">
          More tools grouped on the dashboard ↓
        </p>
      </div>
    </MockChrome>
  )
}

function PreviewHub({
  title,
  pills,
  icon: Icon,
}: {
  title: string
  pills: string[]
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <MockChrome>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bg-overlay)] text-[var(--text-secondary)]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {pills.map((pill) => (
            <span
              key={pill}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>
    </MockChrome>
  )
}

function PreviewIntelligence() {
  return (
    <MockChrome>
      <div className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-[var(--brand-accent)]" />
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">AI insights</span>
        </div>
        {['Renewal risk on Nova Labs', 'Pipeline gap in Proposal stage'].map((line) => (
          <div
            key={line}
            className="rounded-md border border-[var(--brand-accent-border)] bg-[var(--brand-accent-muted)] px-3 py-2 text-[11px] text-[var(--text-primary)]"
          >
            <Sparkles className="mr-1 inline h-3 w-3 text-[var(--brand-accent)]" />
            {line}
          </div>
        ))}
      </div>
    </MockChrome>
  )
}

function PreviewFinish() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)]">
      <span className="icon-tile flex h-14 w-14 items-center justify-center rounded-full">
        <CheckCircle2 className="h-6 w-6 text-[var(--success)]" strokeWidth={1.75} />
      </span>
      <p className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">Ready to explore</p>
      <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">Sample data is loaded</p>
    </div>
  )
}

const PREVIEWS: Record<ProductTourPreviewId, () => JSX.Element> = {
  welcome: PreviewWelcome,
  priorities: PreviewPriorities,
  navigation: PreviewNavigation,
  clients: () => <PreviewHub title="Clients" icon={Users} pills={['Contacts', 'Portal', 'Billing']} />,
  pipeline: () => (
    <PreviewHub title="Pipeline" icon={Handshake} pills={['Deals', 'Aspire', 'LinkedIn', 'Campaigns']} />
  ),
  projects: () => (
    <PreviewHub title="Projects" icon={FolderKanban} pills={['Projects', 'Deliverables', 'Automations']} />
  ),
  intelligence: PreviewIntelligence,
  finish: PreviewFinish,
}

export function SlideMediaPreview({ previewId }: { previewId: ProductTourPreviewId }) {
  const Preview = PREVIEWS[previewId]
  return (
    <div className="flex h-full min-h-[220px] w-full items-center justify-center p-2">
      <div className="w-full max-w-md">
        <Preview />
      </div>
    </div>
  )
}
