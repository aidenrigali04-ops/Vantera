'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

/**
 * The SDR Agent surface, consolidated. One focused tab set — Overview /
 * Sequences / Setup — instead of the wide outreach bar. Setup is the
 * full-screen wizard; the layout hides this nav on the wizard route, so the
 * tab simply launches it.
 */
const TABS = [
  { href: '/admin/outreach/agents', label: 'Overview' },
  { href: '/admin/outreach/agents/setup', label: 'Setup' },
] as const

export function AgentSubNav() {
  const pathname = usePathname() ?? ''
  return <SubNavTabs tabs={TABS} activePath={pathname} ariaLabel="Agent sections" />
}
