'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useBranding } from '@/lib/branding/context'
import { useVerticalLabels } from '@/lib/branding/use-vertical-labels'
import { useUIStore } from '@/lib/stores/ui-store'
import {
  BarChart2,
  Bell,
  Brain,
  Briefcase,
  Calendar,
  CheckSquare,
  CreditCard,
  ExternalLink,
  FileText,
  Handshake,
  Inbox,
  LayoutDashboard,
  Share2,
  Mail,
  Megaphone,
  Package,
  PieChart,
  Plug,
  Settings,
  Telescope,
  TrendingUp,
  Users,
  UsersRound,
  Zap,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type CommandPaletteProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const labels = useVerticalLabels()
  const { businessName } = useBranding()
  const { recentRoutes, pushRecentRoute } = useUIStore()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange])

  const navigate = (href: string) => {
    pushRecentRoute(href)
    router.push(href)
    onOpenChange(false)
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/clients', label: 'Active Clients', icon: Users },
    { href: '/admin/pipeline', label: 'Pipeline', icon: TrendingUp },
    { href: '/admin/outreach/aspire', label: 'Aspire', icon: Telescope },
    { href: '/admin/outreach/linkedin', label: 'LinkedIn', icon: Share2 },
    { href: '/admin/automations', label: 'Automations', icon: Zap },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ]

  const recentItems = recentRoutes
    .map((route) => navItems.find((item) => item.href === route))
    .filter(Boolean)

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={`Search ${businessName || 'workspace'}...`} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentItems.length > 0 ? (
          <>
            <CommandGroup heading="Recent">
              {recentItems.map((item) => {
                if (!item) return null
                const Icon = item.icon
                return (
                  <CommandItem key={`recent-${item.href}`} onSelect={() => navigate(item.href)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}

        <CommandGroup heading="Navigate">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                <Icon className="mr-2 h-4 w-4" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => navigate('/admin/clients?action=create')}>
            <Users className="mr-2 h-4 w-4" />
            Add new {labels.contact.toLowerCase()}
            <CommandShortcut>⇧C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/records?action=create')}>
            <Briefcase className="mr-2 h-4 w-4" />
            Create {labels.record.toLowerCase()}
            <CommandShortcut>⇧J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/pipeline?action=lead')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Add lead
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/billing?action=invoice')}>
            <CreditCard className="mr-2 h-4 w-4" />
            New invoice
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="More">
          <CommandItem onSelect={() => navigate('/admin/inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            Inbox
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/calendar')}>
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/ai-brain')}>
            <Brain className="mr-2 h-4 w-4" />
            AI Insights
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/reports')}>
            <PieChart className="mr-2 h-4 w-4" />
            Reports
          </CommandItem>
          <CommandItem onSelect={() => navigate('/admin/integrations')}>
            <Plug className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/** Standalone hook for global Cmd+K registration outside the palette component. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpen])
}

export const SIDEBAR_ICON_MAP = {
  LayoutDashboard,
  Inbox,
  Bell,
  Calendar,
  TrendingUp,
  Handshake,
  Users,
  FileText,
  Briefcase,
  CheckSquare,
  Zap,
  UsersRound,
  Share2,
  Telescope,
  Megaphone,
  Mail,
  ExternalLink,
  Package,
  CreditCard,
  BarChart2,
  Brain,
  PieChart,
  Settings,
  Plug,
}
