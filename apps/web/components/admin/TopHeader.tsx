'use client'

import type { AdminSession } from '@/lib/auth/types'
import { adminLogoutAction } from '@/lib/auth/actions'
import { useBranding } from '@/lib/branding/context'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
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
import { Bell, Menu, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

type TopHeaderProps = {
  session: AdminSession
}

function usePageTitle(): string {
  const pathname = usePathname() ?? ''
  const labels = useVerticalLabels()

  if (pathname.startsWith('/admin/dashboard')) return 'Dashboard'
  if (pathname.startsWith('/admin/crm/clients')) return 'Active Clients'
  if (pathname.startsWith('/admin/crm/pipeline')) return 'Lead Pipeline'
  if (pathname.startsWith('/admin/crm')) return 'CRM'
  if (pathname.startsWith('/admin/contacts')) return labels.contacts
  if (pathname.startsWith('/admin/records')) return labels.records
  if (pathname.startsWith('/admin/outreach/aspire')) return 'Aspire'
  if (pathname.startsWith('/admin/outreach/linkedin')) return 'LinkedIn'
  if (pathname.startsWith('/admin/outreach')) return 'Outreach'
  if (pathname.startsWith('/admin/automations')) return 'Automations'
  if (pathname.startsWith('/admin/reports')) return 'Reports'
  if (pathname.startsWith('/admin/settings')) return 'Settings'
  if (pathname.startsWith('/admin/ai-brain')) return 'AI Insights'
  if (pathname.startsWith('/admin/calendar')) return 'Calendar'
  if (pathname.startsWith('/admin/onboarding')) return 'Onboarding'

  const tail = pathname.split('/').filter(Boolean).pop() ?? 'Dashboard'
  return tail
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function TopHeader({ session }: TopHeaderProps) {
  const pageTitle = usePageTitle()
  const { plan } = useBranding()
  const { setCommandPaletteOpen, setMobileSidebarOpen } = useUIStore()
  const initials = session.email.slice(0, 2).toUpperCase()
  const planLabel = plan === 'enterprise' ? 'Enterprise' : 'Team'

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-stone-200 bg-white px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation menu"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-lg font-semibold text-stone-900">{pageTitle}</h1>
      </div>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="hidden max-w-md flex-1 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-500 transition-colors hover:border-stone-300 hover:bg-white md:flex"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search anything...</span>
        <kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-500">
          ⌘K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        <Button type="button" variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <Badge variant="secondary" className="hidden sm:inline-flex">
          {planLabel}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-lg border border-stone-200 px-2 py-1.5 transition-colors hover:bg-stone-50',
              )}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-stone-200 text-xs text-stone-700">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm text-stone-700 lg:inline">
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
