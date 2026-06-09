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

/* ─── per-item icon accent colours ─── */
const ICON_ACCENT: Record<string, string> = {
  dashboard: '#47a3f3',
  pipeline: '#63e6be',
  agent: '#bae3ff',
  outreach: '#f3a847',
  inbox: '#a78bfa',
  settings: '#829ab1',
  help: '#829ab1',
}

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
                  className="h-9 w-9 rounded-xl object-contain p-0.5"
                  style={{ background: 'linear-gradient(135deg, #47a3f3 0%, #bae3ff 100%)' }}
                />
              ) : (
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-[#002159]"
                  style={{ background: 'linear-gradient(135deg, #47a3f3 0%, #bae3ff 100%)' }}
                >
                  {initial}
                </span>
              )}
              {/* pulse dot */}
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#090c13]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              </span>
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
                    className="flex w-full items-center justify-center rounded-xl px-2 py-2 text-[var(--text-disabled)] transition-colors hover:bg-[rgba(186,227,255,0.06)] hover:text-[var(--text-tertiary)]"
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
              {/* decorative glow orb */}
              <div
                className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40"
                style={{ background: 'radial-gradient(circle, #47a3f3 0%, transparent 70%)' }}
              />
              <div className="relative">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[rgba(186,227,255,0.12)]">
                  <Zap className="h-4 w-4 text-[#47a3f3]" />
                </div>
                <p className="text-[13px] font-bold text-[var(--text-secondary)]">Need help?</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-disabled)]">
                  Launch your AI SDR agent and start closing more deals.
                </p>
                <Link
                  href="/admin/sdr-agents"
                  onClick={onNavigate}
                  className="sidebar-help-btn mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold text-[#002159] transition-opacity hover:opacity-90"
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
                'flex items-center gap-2 rounded-xl px-2 py-2 text-[12px] text-[var(--text-disabled)] transition-colors hover:bg-[rgba(186,227,255,0.06)] hover:text-[var(--text-tertiary)]',
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
                  className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-[12px] text-[var(--text-disabled)] transition-colors hover:bg-[rgba(186,227,255,0.06)] hover:text-red-400"
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
                    className="flex w-full items-center justify-center rounded-xl px-2 py-2 text-[var(--text-disabled)] transition-colors hover:bg-[rgba(186,227,255,0.06)] hover:text-red-400"
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
  const accentColor = ICON_ACCENT[item.id] ?? '#829ab1'

  const content = (
    <motion.div
      whileHover={collapsed ? undefined : { x: 2 }}
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
            ? 'nav-pill-active'
            : 'hover:bg-[rgba(186,227,255,0.05)] hover:text-[var(--text-primary)]',
        )}
      >
        {/* icon container */}
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg transition-all duration-150',
            collapsed ? 'h-9 w-9' : 'h-8 w-8',
            isActive
              ? 'bg-[rgba(0,33,89,0.25)]'
              : 'bg-[rgba(186,227,255,0.06)] group-hover:bg-[rgba(186,227,255,0.1)]',
          )}
        >
          <Icon
            className="h-4 w-4 transition-colors duration-150"
            style={{ color: isActive ? '#002159' : accentColor }}
          />
        </span>

        {/* label + badge */}
        {!collapsed && (
          <span className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
            <span
              className={cn(
                'truncate text-[13px] font-medium transition-colors duration-150',
                isActive ? 'font-semibold text-[#002159]' : 'text-[var(--text-tertiary)]',
              )}
            >
              {item.label}
            </span>
            {item.highlightLabel && (
              <span className="shrink-0 rounded-full bg-[rgba(0,33,89,0.2)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#002159]">
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
          style={{ background: 'rgba(6,11,28,0.97)' }}
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
      style={{ background: 'rgba(6,11,28,0.97)' }}
    >
      <SidebarContent session={session} collapsed={sidebarCollapsed} />

      {/* collapse toggle */}
      <div className="border-t border-[var(--border-subtle)] p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-full justify-start text-[var(--text-disabled)] hover:bg-[rgba(186,227,255,0.06)] hover:text-[var(--text-tertiary)]"
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
