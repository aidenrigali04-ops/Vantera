'use client'

import { cn } from '@/lib/utils'
import { Bell, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

const ROUTE_LABELS: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/contacts': 'Contacts',
  '/admin/pipeline': 'Pipeline',
  '/admin/operations': 'Operations',
  '/admin/integrations': 'Integrations',
  '/admin/ai-brain': 'AI Agents',
  '/admin/reports': 'Reports',

  '/admin/settings': 'Settings',
  '/admin/help': 'Help Center',
  '/admin/onboarding': 'Onboarding',
}

type Props = {
  businessName: string
  aiEnabled: boolean
}

/**
 * Skinny top bar. Renders a breadcrumb-style title row and a small status
 * cluster on the right (AI status, search affordance). Intentionally
 * lightweight — most action affordances live inside page content, not the
 * chrome.
 */
export function AdminTopBar({ businessName, aiEnabled }: Props) {
  const pathname = usePathname() ?? ''
  const label = ROUTE_LABELS[pathname] ?? friendlyFromPath(pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/90 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--text-tertiary)]">{businessName || 'Workspace'}</span>
        <span aria-hidden className="text-[var(--text-disabled)]">
          /
        </span>
        <span className="font-semibold text-[var(--text-primary)]">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-xs text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          aria-label="Search (coming soon)"
          disabled
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--text-disabled)] sm:inline">
            ⌘K
          </kbd>
        </button>

        <span
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[10px] font-medium uppercase tracking-wider',
            aiEnabled
              ? 'border-emerald-600/20 bg-emerald-50 text-emerald-700'
              : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-disabled)]',
          )}
          title={aiEnabled ? 'AI brain is live' : 'AI brain is dormant'}
        >
          <span
            aria-hidden
            className={cn(
              'inline-flex h-1.5 w-1.5 rounded-full',
              aiEnabled ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-[var(--text-disabled)]',
            )}
          />
          AI {aiEnabled ? 'Live' : 'Offline'}
        </span>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-tertiary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          aria-label="Notifications (coming soon)"
          disabled
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </header>
  )
}

function friendlyFromPath(pathname: string): string {
  const tail = pathname.split('/').filter(Boolean).pop() ?? ''
  if (!tail) return 'Dashboard'
  return tail
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
