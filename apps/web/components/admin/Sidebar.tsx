'use client'

import { adminLogoutAction } from '@/lib/auth/actions'
import type { AdminSession } from '@/lib/auth/types'
import { useBranding } from '@/lib/branding/context'
import {
  ADMIN_NAV_FOOTER,
  getSidebarNavItems,
  isSidebarItemActive,
  type AdminNavItem,
} from '@/lib/navigation/admin-nav'
import { isStartHereBadgeActive } from '@/lib/onboarding/prompts'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Rocket,
  Search,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

/* icons are monochrome — accent only comes from the active gradient pill */

type SidebarProps = {
  session: AdminSession
  mobile?: boolean
  onNavigate?: () => void
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SIDEBAR CONTENT                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

function SidebarContent({
  session,
  collapsed,
  onNavigate,
}: SidebarProps & { collapsed: boolean }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { businessName, logoUrl } = useBranding()
  const { setCommandPaletteOpen } = useUIStore()
  const [startHereActive, setStartHereActive] = useState(false)
  const displayName = (businessName || 'Workspace').slice(0, 18)
  const initial = (businessName?.trim()?.[0] ?? 'V').toUpperCase()

  useEffect(() => {
    setStartHereActive(isStartHereBadgeActive(session.accountId))
  }, [session.accountId, pathname])

  const sidebarItems = useMemo(
    () =>
      getSidebarNavItems().map((item) =>
        item.id === 'dashboard' && startHereActive
          ? { ...item, highlightLabel: 'Start here' }
          : item,
      ),
    [startHereActive],
  )

  const footerItems = ADMIN_NAV_FOOTER

  return (
    <TooltipProvider delayDuration={0}>
      {/* outer wrapper — full frosted navy background */}
      <div className="sidebar-vision flex h-full flex-col">

        {/* ── Brand header ── */}
        <div className={cn('px-4 py-5', collapsed && 'px-3 py-4')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div className="relative shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="icon-tile h-9 w-9 rounded-xl object-contain p-1"
                />
              ) : (
                <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold text-[var(--text-secondary)]">
                  {initial}
                </span>
              )}
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold tracking-[-0.01em] text-[var(--text-secondary)]">
                  {displayName}
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-disabled)]">
                  Vantera OS
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Search bar (expanded only) ── */}
        {!collapsed && (
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="sidebar-search-btn flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[var(--text-disabled)] transition-colors hover:text-[var(--text-tertiary)]"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded-md border border-[var(--border-subtle)] bg-[rgba(186,227,255,0.04)] px-1 py-0.5 text-[9px] tracking-wide">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* ── Nav groups ── */}
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Main navigation">

          {/* Core group */}
          {!collapsed && (
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)]">
              Core
            </p>
          )}
          <ul className="space-y-0.5">
            {sidebarItems.map((item) => (
              <NavItemRow
                key={item.id}
                item={item}
                isActive={item.href ? isSidebarItemActive(pathname, item) : false}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>

          {/* Workspace group */}
          <div className={cn('mt-5', collapsed && 'mt-4')}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-disabled)]">
                Workspace
              </p>
            )}
            {collapsed && <div className="my-3 border-t border-[var(--border-subtle)]" />}
            <ul className="space-y-0.5">
              {footerItems.map((item) => (
                <NavItemRow
                  key={item.id}
                  item={item}
                  isActive={item.href ? isSidebarItemActive(pathname, item) : false}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>

          {/* Collapsed search */}
          {collapsed && (
            <div className="mt-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex w-full items-center justify-center rounded-xl px-2 py-2 text-[var(--text-disabled)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-tertiary)]"
                    aria-label="Search"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Search (⌘K)</TooltipContent>
              </Tooltip>
            </div>
          )}
        </nav>

        {/* ── Help card (expanded only) ── */}
        {!collapsed && (
          <div className="px-3 pb-3">
            <div className="sidebar-help-card relative overflow-hidden rounded-2xl p-4">
              <div className="relative">
                <div className="icon-tile mb-2 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Zap className="h-4 w-4 text-[var(--text-secondary)]" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="text-[13px] font-bold text-[var(--text-secondary)]">Get started</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-disabled)]">
                  Launch your AI SDR agent and start closing more deals.
                </p>
                <Link
                  href="/admin/sdr-agents"
                  onClick={onNavigate}
                  className="sidebar-help-btn mt-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <Rocket className="h-3.5 w-3.5" />
                  Launch Agent
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer: refresh + logout + email ── */}
        <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 py-3">
          <div className="flex items-center gap-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                router.refresh()
                onNavigate?.()
              }}
              className={cn(
                'flex items-center gap-2 rounded-xl px-2 py-2 text-[12px] text-[var(--text-disabled)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text-tertiary)]',
                collapsed && 'w-full justify-center',
              )}
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && <span>Refresh</span>}
            </motion.button>

            {!collapsed && (
              <form action={adminLogoutAction} className="ml-auto">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-[12px] text-[var(--text-disabled)] transition-colors hover:bg-white/[0.04] hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </form>
            )}
          </div>

          {!collapsed && (
            <p className="mt-2 truncate px-2 text-[10px] text-[var(--text-disabled)]">
              {session.email}
            </p>
          )}

          {collapsed && (
            <form action={adminLogoutAction} className="mt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center rounded-xl px-2 py-2 text-[var(--text-disabled)] transition-colors hover:bg-white/[0.04] hover:text-red-400"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign out</TooltipContent>
              </Tooltip>
            </form>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  NAV ITEM ROW                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function NavItemRow({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: AdminNavItem
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const content = (
    <motion.div
      whileHover={isActive || collapsed ? undefined : { x: 2 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <Link
        href={item.href!}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        data-tour={item.tourAnchor}
        className={cn(
          'group relative flex w-full items-center rounded-xl transition-all duration-150',
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
          isActive
            ? 'nav-pill-active cursor-default'
            : 'hover:bg-white/[0.04]',
        )}
      >
        {/* icon */}
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg transition-all duration-150',
            collapsed ? 'h-9 w-9' : 'h-8 w-8',
          )}
        >
          <Icon
            className={cn(
              'h-4 w-4 transition-colors duration-150',
              isActive
                ? 'text-white'
                : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </span>

        {/* label + badge */}
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
            <span
              className={cn(
                'truncate text-[13px] transition-colors duration-150',
                isActive
                  ? 'font-semibold text-white'
                  : 'font-medium text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]',
              )}
            >
              {item.label}
            </span>
            {item.highlightLabel && (
              <span className="shrink-0 rounded-full bg-white/[0.1] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {item.highlightLabel}
              </span>
            )}
          </span>
        )}
      </Link>
    </motion.div>
  )

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      </li>
    )
  }

  return <li>{content}</li>
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  EXPORTED SIDEBAR                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */

export function Sidebar({ session, mobile, onNavigate }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  if (mobile) {
    return (
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          className="w-[260px] border-[var(--border-subtle)] p-0"
          style={{ background: 'rgba(0,0,0,0.97)' }}
        >
          <SidebarContent
            session={session}
            onNavigate={() => {
              setMobileSidebarOpen(false)
              onNavigate?.()
            }}
            collapsed={false}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-[var(--border-subtle)] transition-[width] duration-200 md:flex',
        sidebarCollapsed ? 'w-16' : 'w-[240px]',
      )}
      style={{ background: 'rgba(0,0,0,0.97)' }}
    >
      <SidebarContent session={session} collapsed={sidebarCollapsed} />

      {/* collapse toggle */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-full justify-start text-[var(--text-disabled)] hover:bg-white/[0.04] hover:text-[var(--text-tertiary)]"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 text-xs">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  )
}

export function SidebarMobile({ session }: { session: AdminSession }) {
  return <Sidebar session={session} mobile />
}
