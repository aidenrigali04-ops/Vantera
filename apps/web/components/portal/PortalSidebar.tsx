'use client'

import { TenantBrandMark } from '@/components/branding/tenant-brand-mark'
import { portalLogoutAction } from '@/lib/auth/actions'
import { buildPortalNavItems, type PortalSectionId } from '@/lib/portal/portal-config'
import { usePortalShell } from '@/lib/portal/context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Activity,
  CreditCard,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Menu,
  MessageSquare,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const ICON_BY_SECTION: Record<PortalSectionId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  projects: FolderKanban,
  messages: MessageSquare,
  billing: CreditCard,
  documents: FileText,
  activity: Activity,
}

function badgeForSection(
  id: PortalSectionId,
  counts: ReturnType<typeof usePortalShell>['navCounts'],
): number | undefined {
  switch (id) {
    case 'messages':
      return counts.unreadMessages > 0 ? counts.unreadMessages : undefined
    case 'billing':
      return counts.openInvoices + counts.pendingApprovals > 0
        ? counts.openInvoices + counts.pendingApprovals
        : undefined
    case 'projects':
      return counts.projects > 0 ? counts.projects : undefined
    case 'documents':
      return counts.documents > 0 ? counts.documents : undefined
    case 'activity':
      return counts.activities > 0 ? counts.activities : undefined
    default:
      return undefined
  }
}

type PortalSidebarProps = {
  mobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}

export function PortalSidebar({ mobileOpen, onMobileOpenChange }: PortalSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const previewView = searchParams.get('view') ?? 'overview'
  const { workspace, navCounts, preview, previewContactId } = usePortalShell()
  const { config } = workspace

  const navItems = buildPortalNavItems(config, {}).map((item) => ({
    ...item,
    badge: badgeForSection(item.id, navCounts),
  }))

  useEffect(() => {
    onMobileOpenChange(false)
  }, [pathname, onMobileOpenChange])

  const navContent = (
    <>
      <div className="border-b border-[var(--border-subtle)] px-4 py-5">
        <TenantBrandMark size="sm" />
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {config.tagline}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Client portal">
        {navItems.map((item) => {
          const Icon = ICON_BY_SECTION[item.id]
          const active = preview
            ? item.id === previewView || (item.id === 'overview' && previewView === 'overview')
            : item.href === '/portal'
              ? pathname === '/portal'
              : pathname === item.href || pathname.startsWith(`${item.href}/`)

          const href =
            preview && previewContactId
              ? item.id === 'overview'
                ? `/admin/portal/preview?contact=${previewContactId}`
                : `/admin/portal/preview?contact=${previewContactId}&view=${item.id}`
              : item.href

          return (
            <Link
              key={item.id}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-120 ease',
                'focus-visible:outline-none focus-visible:shadow-[var(--shadow-glow)]',
                active
                  ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge > 0 ? (
                <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-[var(--border-subtle)] p-3">
        {preview ? (
          <span className="block rounded-lg bg-[var(--bg-elevated)] px-3 py-2 text-center text-[11px] font-medium text-[var(--text-secondary)]">
            Preview mode
          </span>
        ) : (
          <form action={portalLogoutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              Sign out
            </Button>
          </form>
        )}
      </div>
    </>
  )

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] md:hidden focus-visible:shadow-[var(--shadow-glow)]"
        onClick={() => onMobileOpenChange(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-controls="portal-sidebar"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          aria-label="Close navigation"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      <aside
        id="portal-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-subtle)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
