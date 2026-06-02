'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/outreach/agents', label: 'SDR Agents' },
  { href: '/admin/outreach/aspire', label: 'Aspire' },
  { href: '/admin/outreach/linkedin', label: 'LinkedIn' },
  { href: '/admin/outreach/campaigns', label: 'Campaigns' },
  { href: '/admin/outreach/email', label: 'Email' },
  { href: '/admin/outreach/inbox', label: 'Inbox' },
  { href: '/admin/outreach/analytics', label: 'Analytics' },
] as const

export function OutreachSubNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Outreach sections" />
}
