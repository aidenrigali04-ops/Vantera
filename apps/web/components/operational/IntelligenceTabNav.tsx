'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/leads', label: 'Pipeline' },
] as const

export function IntelligenceTabNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Sales intelligence sections" />
}
