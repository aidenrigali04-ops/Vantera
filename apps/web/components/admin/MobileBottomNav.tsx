'use client'

import { getAvailableAdminNavItems } from '@/lib/navigation/admin-nav'
import { cn } from '@/lib/utils'
import { Inbox, LayoutDashboard, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MOBILE_PRIMARY = [
  { href: '/admin/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/inbox', label: 'Inbox', icon: Inbox },
  { href: '/admin/pipeline', label: 'Deals', icon: TrendingUp },
  { href: '/admin/clients', label: 'Contacts', icon: Users },
] as const

/** Routes surfaced in mobile nav — must exist in admin nav config. */
const MOBILE_NAV = MOBILE_PRIMARY.filter((item) =>
  getAvailableAdminNavItems().some((nav) => nav.href === item.href),
)

export function MobileBottomNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className={cn('grid', MOBILE_NAV.length === 4 ? 'grid-cols-4' : 'grid-cols-5')}>
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium',
                active ? 'text-stone-900' : 'text-stone-500',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-stone-900')} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
