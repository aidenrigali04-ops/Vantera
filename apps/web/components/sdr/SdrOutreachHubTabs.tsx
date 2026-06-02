'use client'

import { SubNavTabs } from '@/components/operational/SubNavTabs'
import { usePathname } from 'next/navigation'

const SDR_OUTREACH_TABS = [
  { href: '/admin/outreach/agents', label: 'Command center' },
  { href: '/admin/outreach/aspire', label: 'Lead finder' },
  { href: '/admin/pipeline', label: 'Pipeline' },
  { href: '/admin/outreach/agents/sequences', label: 'Sequences' },
] as const

export function SdrOutreachHubTabs() {
  const pathname = usePathname() ?? ''

  return (
    <SubNavTabs
      tabs={SDR_OUTREACH_TABS}
      activePath={pathname}
      ariaLabel="SDR outreach sections"
    />
  )
}
