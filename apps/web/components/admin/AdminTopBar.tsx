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
  '/admin/portal': 'Client Portal',
  '/admin/portal/preview': 'Client Portal Preview',
  '/admin/settings': 'Settings',
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0B1015]/85 px-6 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-white/40">{businessName || 'Workspace'}</span>
        <span aria-hidden className="text-white/20">
          /
        </span>
        <span className="font-semibold text-white">{label}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/40 transition-colors hover:border-white/[0.12] hover:text-white/70"
          aria-label="Search (coming soon)"
          disabled
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/40 sm:inline">
            ⌘K
          </kbd>
        </button>

        <span
          className={cn(
            'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[10px] font-medium uppercase tracking-wider',
            aiEnabled
              ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
              : 'border-white/[0.06] bg-white/[0.02] text-white/40',
          )}
          title={aiEnabled ? 'AI brain is live' : 'AI brain is dormant'}
        >
          <span
            aria-hidden
            className={cn(
              'inline-flex h-1.5 w-1.5 rounded-full',
              aiEnabled ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]' : 'bg-white/30',
            )}
          />
          AI {aiEnabled ? 'Live' : 'Offline'}
        </span>

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.02] text-white/40 transition-colors hover:border-white/[0.12] hover:text-white/70"
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
