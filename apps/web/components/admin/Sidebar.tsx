'use client'

import { adminLogoutAction } from '@/lib/auth/actions'
import type { AdminSession } from '@/lib/auth/types'
import { useBranding } from '@/lib/branding/context'
import { FeatureGate } from '@/lib/feature-flags/gate-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  BarChart2,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Share2,
  LogOut,
  Mail,
  Megaphone,
  Package,
  PieChart,
  Plug,
  Settings,
  Telescope,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

type NavItemDef = {
  href: string
  label: string
  icon: LucideIcon
  badge?: number
  flag?: 'executive_dashboard'
}

type NavGroupDef = {
  title: string
  items: NavItemDef[]
}

type SidebarProps = {
  session: AdminSession
  mobile?: boolean
  onNavigate?: () => void
}

function useNavGroups(): NavGroupDef[] {
  return [
    {
      title: 'Command',
      items: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: 0 },
        { href: '/admin/calendar', label: 'Calendar', icon: Calendar },
      ],
    },
    {
      title: 'CRM',
      items: [
        { href: '/admin/crm/clients', label: 'Active Clients', icon: Users },
        { href: '/admin/crm/pipeline', label: 'Lead Pipeline', icon: TrendingUp },
        { href: '/admin/crm/inbox', label: 'Inbox', icon: Inbox },
        { href: '/admin/crm/analytics', label: 'Analytics', icon: BarChart2 },
      ],
    },
    {
      title: 'Outreach',
      items: [
        { href: '/admin/outreach/aspire', label: 'Aspire', icon: Telescope },
        { href: '/admin/outreach/linkedin', label: 'LinkedIn', icon: Share2 },
        { href: '/admin/outreach/campaigns', label: 'Campaigns', icon: Megaphone },
        { href: '/admin/outreach/email', label: 'Email', icon: Mail },
      ],
    },
    {
      title: 'Client',
      items: [
        { href: '/admin/portal', label: 'Client Portal', icon: ExternalLink },
        { href: '/admin/deliverables', label: 'Deliverables', icon: Package },
        { href: '/admin/billing', label: 'Billing', icon: CreditCard },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { href: '/admin/forecasting', label: 'Forecasting', icon: BarChart2, flag: 'executive_dashboard' },
        { href: '/admin/ai-brain', label: 'AI Insights', icon: Brain },
        { href: '/admin/reports', label: 'Reports', icon: PieChart, flag: 'executive_dashboard' },
      ],
    },
  ]
}

function SidebarContent({ session, collapsed, onNavigate }: SidebarProps & { collapsed: boolean }) {
  const pathname = usePathname() ?? ''
  const { businessName, logoUrl } = useBranding()
  const groups = useNavGroups()
  const displayName = (businessName || 'Workspace').slice(0, 18)
  const initial = (businessName?.trim()?.[0] ?? 'W').toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col bg-stone-900 text-stone-100">
        <div className={cn('border-b border-stone-800 px-4 py-4', collapsed && 'px-2')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-lg bg-stone-800 object-contain p-1"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-700 text-sm font-semibold">
                {initial}
              </span>
            )}
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="text-[10px] uppercase tracking-wider text-stone-500">Admin</p>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Admin navigation">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-stone-500">
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const row = (
                    <NavItemRow
                      key={item.href}
                      item={item}
                      isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  )

                  if (item.flag) {
                    return (
                      <FeatureGate key={item.href} flag={item.flag}>
                        {row}
                      </FeatureGate>
                    )
                  }

                  return row
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-stone-800 p-2">
          <NavItemRow
            item={{ href: '/admin/settings', label: 'Settings', icon: Settings }}
            isActive={pathname.startsWith('/admin/settings')}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
          <NavItemRow
            item={{ href: '/admin/integrations', label: 'Integrations', icon: Plug }}
            isActive={pathname.startsWith('/admin/integrations')}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
          <form action={adminLogoutAction} className="mt-1">
            <button
              type="submit"
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-stone-400 transition-all duration-150 hover:bg-stone-800 hover:text-stone-100',
                collapsed && 'justify-center px-2',
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed ? <span>Sign out</span> : null}
            </button>
          </form>
          {!collapsed ? (
            <p className="mt-2 truncate px-2 text-[10px] text-stone-600">{session.email}</p>
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
  item: NavItemDef
  isActive: boolean
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150',
        isActive ? 'bg-stone-700 text-white' : 'text-stone-300 hover:bg-stone-800 hover:text-stone-100',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed ? (
        <>
          <span className="flex-1 truncate font-medium">{item.label}</span>
          {item.badge && item.badge > 0 ? (
            <span className="rounded-full bg-stone-700 px-1.5 py-0.5 text-[10px] font-medium">
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  )

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      </li>
    )
  }

  return <li>{link}</li>
}

export function Sidebar({ session, mobile, onNavigate }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  if (mobile) {
    return (
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-64 border-stone-800 bg-stone-900 p-0 text-stone-100">
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
        'hidden h-full shrink-0 flex-col border-r border-stone-800 transition-all duration-150 md:flex',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <SidebarContent session={session} collapsed={sidebarCollapsed} />
      <div className="border-t border-stone-800 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="w-full text-stone-400 hover:bg-stone-800 hover:text-stone-100"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-2 text-xs">Collapse</span>
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

export function SidebarNavShell({ children }: { children: ReactNode }) {
  return children
}
