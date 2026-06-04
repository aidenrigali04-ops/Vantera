'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/crm/pipeline', label: 'Pipeline' },
  { href: '/admin/crm/clients', label: 'Active clients' },
] as const

export function CrmTabNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="CRM sections" />
}
