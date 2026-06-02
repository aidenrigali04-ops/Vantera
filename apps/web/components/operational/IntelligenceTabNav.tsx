'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/clients', label: 'Active Clients' },
] as const

export function IntelligenceTabNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Sales intelligence sections" />
}
