'use client'

import { getMobileNavItems, isSidebarItemActive } from '@/lib/navigation/admin-nav'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MOBILE_NAV = getMobileNavItems()

export function MobileBottomNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-default)] bg-[#090c13]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-4">
        {MOBILE_NAV.map((item) => {
          const active = item.href ? isSidebarItemActive(pathname, item) : false
          const Icon = item.icon
          const label = item.id === 'dashboard' ? 'Home' : item.label

          return (
            <Link
              key={item.id}
              href={item.href!}
              className={cn(
                'flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', active && 'text-[var(--text-primary)]')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
