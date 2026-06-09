'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/outreach/campaigns', label: 'Campaigns' },
  { href: '/admin/outreach/agents/sequences', label: 'Sequences' },
  { href: '/admin/outreach/linkedin', label: 'LinkedIn' },
  { href: '/admin/outreach/email', label: 'Email' },
  { href: '/admin/outreach/aspire', label: 'Lead finder' },
  { href: '/admin/inbox', label: 'Inbox' },
] as const

export function OutreachSubNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Outreach sections" />
}
