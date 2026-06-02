'use client'

import { adminLogoutAction } from '@/lib/auth/actions'
import type { AdminSession } from '@/lib/auth/types'
import { useBranding } from '@/lib/branding/context'
import {
  ADMIN_NAV_FOOTER,
  getSidebarNavItems,
  isAdminNavItemActive,
  isSidebarItemActive,
  type AdminNavItem,
} from '@/lib/navigation/admin-nav'
import { isStartHereBadgeActive } from '@/lib/onboarding/prompts'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronLeft, ChevronRight, LogOut, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type SidebarProps = {
  session: AdminSession
  mobile?: boolean
  onNavigate?: () => void
}

function SidebarContent({ session, collapsed, onNavigate }: SidebarProps & { collapsed: boolean }) {
  const pathname = usePathname() ?? ''
  const { businessName, logoUrl } = useBranding()
  const { setCommandPaletteOpen } = useUIStore()
  const [startHereActive, setStartHereActive] = useState(false)
  const displayName = (businessName || 'Workspace').slice(0, 20)
  const initial = (businessName?.trim()?.[0] ?? 'W').toUpperCase()

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

  return (
    <TooltipProvider delayDuration={0}>
      <div className="sidebar-gradient flex h-full flex-col text-stone-900">
        <div className={cn('border-b border-stone-200/80 px-3 py-3.5', collapsed && 'px-2')}>
          <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md border border-stone-200 bg-stone-50 object-contain p-0.5"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-200 bg-stone-100 text-xs font-semibold text-stone-700">
                {initial}
              </span>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">{displayName}</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-stone-400">
                  Workspace
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Platform navigation">
          {!collapsed ? (
            <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
              Go to
            </p>
          ) : null}
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

          {collapsed ? (
            <div className="mt-3 px-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex w-full items-center justify-center rounded-md px-2 py-2 text-stone-500 transition-colors hover:bg-stone-50 hover:text-stone-800"
                    aria-label="Search all tools"
                  >
                    <Search className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Search all tools (⌘K)</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <p className="mt-4 px-2 text-[11px] leading-relaxed text-stone-400">
              More tools are grouped on the dashboard. Press{' '}
              <kbd className="rounded border border-stone-200 bg-stone-50 px-1 py-0.5 text-[10px] font-medium text-stone-500">
                ⌘K
              </kbd>{' '}
              to jump anywhere.
            </p>
          )}
        </nav>

        <div className="border-t border-stone-200/80 p-2">
          <ul className="space-y-0.5">
            {ADMIN_NAV_FOOTER.map((item) => (
              <NavItemRow
                key={item.id}
                item={item}
                isActive={item.href ? isSidebarItemActive(pathname, item) : false}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
          <form action={adminLogoutAction} className="mt-1">
            <button
              type="submit"
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-stone-500 transition-colors duration-150 hover:bg-stone-100 hover:text-stone-800',
                collapsed && 'justify-center px-2',
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed ? <span>Sign out</span> : null}
            </button>
          </form>
          {!collapsed ? (
            <p className="mt-2 truncate px-2 text-[11px] text-stone-400">{session.email}</p>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}

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

  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.highlightLabel ? (
            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/80">
              {item.highlightLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </>
  )

  const className = cn(
    'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-150',
    isActive
      ? 'bg-stone-100 font-medium text-stone-900'
      : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
    collapsed && 'justify-center px-2',
  )

  const content = (
    <Link
      href={item.href!}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      data-tour={item.tourAnchor}
      className={className}
    >
      {inner}
    </Link>
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

export function Sidebar({ session, mobile, onNavigate }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  if (mobile) {
    return (
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="sidebar-gradient w-[240px] border-stone-200 p-0 text-stone-900">
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
        'sidebar-gradient hidden h-full shrink-0 flex-col border-r border-stone-200/80 transition-[width] duration-150 md:flex',
        sidebarCollapsed ? 'w-16' : 'w-[240px]',
      )}
    >
      <SidebarContent session={session} collapsed={sidebarCollapsed} />
      <div className="border-t border-stone-200/80 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-full justify-start text-stone-500 hover:bg-stone-100 hover:text-stone-800"
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
