'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/crm/clients', label: 'Active Clients' },
  { href: '/admin/crm/pipeline', label: 'Lead Pipeline' },
  { href: '/admin/crm/prospecting', label: 'Prospecting' },
  { href: '/admin/crm/outreach', label: 'Outreach' },
  { href: '/admin/crm/inbox', label: 'Inbox' },
  { href: '/admin/crm/analytics', label: 'Analytics' },
] as const

export function CrmTabNav() {
  const pathname = usePathname() ?? ''

  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-stone-200 pb-px"
      aria-label="CRM sections"
    >
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          pathname.startsWith(`${tab.href}/`) ||
          (tab.href === '/admin/crm/clients' && pathname.startsWith('/admin/crm/clients'))
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
