'use client'

import { cn } from '@/lib/utils'
import { LayoutDashboard, Share2, Telescope, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/admin/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/pipeline', label: 'Pipeline', icon: TrendingUp },
  { href: '/admin/outreach/aspire', label: 'Aspire', icon: Telescope },
  { href: '/admin/outreach/linkedin', label: 'LinkedIn', icon: Share2 },
] as const

export function MobileBottomNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
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
