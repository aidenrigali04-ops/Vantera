'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { CommandPalette } from './CommandPalette'
import { MobileBottomNav } from './MobileBottomNav'
import { Sidebar, SidebarMobile } from './Sidebar'
import { TopHeader } from './TopHeader'
import { WorkspaceMain } from './WorkspaceMain'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'

type AdminShellProps = {
  session: AdminSession
  onboardingIncomplete?: boolean
  bare?: boolean
  /** Allow page content to span full width (tables, agents, aspire). */
  workspaceFullBleed?: boolean
  children: ReactNode
}

export function AdminShell({
  session,
  onboardingIncomplete = false,
  bare,
  workspaceFullBleed = false,
  children,
}: AdminShellProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, sidebarCollapsed } = useUIStore()

  if (bare) {
    return <div className="min-h-screen bg-[var(--bg-base)]">{children}</div>
  }

  return (
    <>
      <div
        className={cn(
          'grid h-[100dvh] overflow-hidden bg-[var(--bg-base)]',
          'grid-rows-[3.5rem_1fr]',
          sidebarCollapsed
            ? 'md:grid-cols-[4rem_1fr] grid-cols-1'
            : 'md:grid-cols-[240px_1fr] grid-cols-1',
        )}
      >
        <div className="col-start-1 row-span-2 row-start-1 hidden md:block">
          <Sidebar session={session} />
        </div>

        <div className="col-start-1 row-start-1 md:col-start-2">
          <TopHeader session={session} showDemoWorkspace={false} />
        </div>

        <div className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden md:col-start-2">
          <WorkspaceMain constrained={!workspaceFullBleed}>{children}</WorkspaceMain>
        </div>
      </div>

      <SidebarMobile session={session} />
      <MobileBottomNav />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  )
}

/** @deprecated Use AdminShell — kept for imports during migration */
export { AdminShell as default }
