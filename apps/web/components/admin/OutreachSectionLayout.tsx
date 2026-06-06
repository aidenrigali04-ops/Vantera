'use client'

import { AdminSubNavRail } from '@/components/admin/AdminPageContent'
import { AgentSubNav } from '@/components/operational/AgentSubNav'
import { OutreachSubNav } from '@/components/operational/OutreachSubNav'
import { isAdminFullBleedPath } from '@/lib/navigation/admin-page-layout'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function OutreachSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const variant = isAdminFullBleedPath(pathname) ? 'shell' : 'inset'

  // The Agent surface gets its own focused tabs; everything else keeps the
  // Campaigns/channels bar. Each area asks the user to understand only itself.
  const inAgentArea = pathname.startsWith('/admin/outreach/agents')

  // Full-screen flows (the SDR setup wizard, scout config) own the whole screen.
  const isFullScreenFlow =
    pathname.startsWith('/admin/outreach/agents/setup') ||
    pathname.startsWith('/admin/outreach/agents/scout/configure')

  return (
    <>
      {!isFullScreenFlow ? (
        <AdminSubNavRail variant={variant}>
          {inAgentArea ? <AgentSubNav /> : <OutreachSubNav />}
        </AdminSubNavRail>
      ) : null}
      {children}
    </>
  )
}
