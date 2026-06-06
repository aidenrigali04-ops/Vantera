'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

// Campaigns + channels context. The Agent and its Sequences live in their own
// focused surface (AgentSubNav), not this bar. Inbox is the top-level route
// (the old `/admin/outreach/inbox` + `…/analytics` tabs were 404s).
const TABS = [
  { href: '/admin/outreach/campaigns', label: 'Campaigns' },
  { href: '/admin/outreach/linkedin', label: 'LinkedIn' },
  { href: '/admin/outreach/email', label: 'Email' },
  { href: '/admin/outreach/aspire', label: 'Lead finder' },
  { href: '/admin/inbox', label: 'Inbox' },
] as const

export function OutreachSubNav() {
  const pathname = usePathname() ?? ''

  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Outreach sections" />
}
