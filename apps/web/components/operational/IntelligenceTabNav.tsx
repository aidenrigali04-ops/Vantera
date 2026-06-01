'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/clients', label: 'Active Clients' },
] as const

export function IntelligenceTabNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-stone-200 pb-px"
      aria-label="Sales intelligence sections"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
