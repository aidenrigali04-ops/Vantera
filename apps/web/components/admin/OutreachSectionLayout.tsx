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
  // Sequences are output (live in Outreach nav), not agent config
  const inAgentArea =
    pathname.startsWith('/admin/outreach/agents') &&
    !pathname.startsWith('/admin/outreach/agents/sequences')

  // Agent workspaces use a dedicated config + analytics layout (no sub-nav chrome).
  const isFullScreenFlow =
    pathname.startsWith('/admin/outreach/agents/setup') ||
    pathname.startsWith('/admin/outreach/agents/scout') ||
    pathname.startsWith('/admin/outreach/agents/outreach') ||
    pathname.startsWith('/admin/outreach/agents/drafter') ||
    pathname.startsWith('/admin/outreach/agents/analyst')

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
