'use client'

import type { AdminSession } from '@/lib/auth/types'
import { adminLogoutAction } from '@/lib/auth/actions'
import { useBranding } from '@/lib/branding/context'
import {
  resolveAdminPageTitle,
  resolveWorkspacePrimaryAction,
} from '@/lib/navigation/admin-nav'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Bell, Inbox, Menu, MoreHorizontal, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type TopHeaderProps = {
  session: AdminSession
  showDemoWorkspace?: boolean
}

export function TopHeader({ session, showDemoWorkspace = false }: TopHeaderProps) {
  const pathname = usePathname() ?? ''
  const isDashboard = pathname.startsWith('/admin/dashboard')
  const pageTitle = resolveAdminPageTitle(pathname)
  const primaryAction = resolveWorkspacePrimaryAction(pathname)
  const { plan } = useBranding()
  const { setCommandPaletteOpen, setMobileSidebarOpen } = useUIStore()
  const initials = session.email.slice(0, 2).toUpperCase()
  const planLabel = plan === 'enterprise' ? 'Enterprise' : 'Team'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-surface)]/90 px-4 backdrop-blur-sm md:gap-4 md:px-6">
      <div className={cn('flex min-w-0 items-center gap-2 md:gap-3', isDashboard ? 'md:min-w-0' : 'md:min-w-[180px]')}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 md:hidden"
          aria-label="Open navigation menu"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        {!isDashboard ? (
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)] md:text-base">
              {pageTitle}
            </h1>
            <p className="hidden truncate text-[11px] text-[var(--text-tertiary)] md:block">
              Vantera operating system
            </p>
          </div>
        ) : showDemoWorkspace ? (
          <p className="hidden text-[11px] font-medium text-[var(--text-secondary)] md:block">
            Sample workspace
          </p>
        ) : null}
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/80 px-3 py-2 text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left">Search workspace…</span>
          <kbd className="rounded border border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 lg:hidden"
          aria-label="Search"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        {primaryAction?.href ? (
          <Button
            asChild
            size="sm"
            className="hidden h-9 bg-[var(--accent)] text-[var(--text-primary)] shadow-sm hover:bg-[var(--accent-hover)] sm:inline-flex"
          >
            <Link href={primaryAction.href}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {primaryAction.label}
            </Link>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Inbox"
          asChild
        >
          <Link href="/admin/inbox">
            <Inbox className="h-5 w-5" />
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </Button>

        {isDashboard ? (
          <Button type="button" variant="ghost" size="icon" className="h-9 w-9" aria-label="More options">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        ) : null}

        <Badge variant="secondary" className="hidden border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-tertiary)] sm:inline-flex">
          {planLabel}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-1.5 py-1 transition-colors duration-150 hover:bg-[var(--bg-overlay)]',
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)]">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-[13px] text-[var(--text-secondary)] lg:inline">
                {session.email.split('@')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled>My Profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Account Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={adminLogoutAction} className="w-full">
                <button type="submit" className="w-full text-left">
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
