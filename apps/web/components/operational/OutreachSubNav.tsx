'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

/**
 * Outreach sections, ordered by workflow: orient (Overview), do the work
 * (Campaigns, Sequences), maintain the rails (LinkedIn, Email). Replies live
 * in the global Inbox in the sidebar.
 */
const TABS = [
  { href: '/admin/outreach', label: 'Overview', exact: true },
  { href: '/admin/outreach/campaigns', label: 'Campaigns' },
  { href: '/admin/outreach/agents/sequences', label: 'Sequences' },
  { href: '/admin/outreach/linkedin', label: 'LinkedIn' },
  { href: '/admin/outreach/email', label: 'Email' },
] as const

export function OutreachSubNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Outreach sections" />
}
