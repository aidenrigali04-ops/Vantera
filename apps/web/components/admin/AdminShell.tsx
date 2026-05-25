'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { CommandPalette } from './CommandPalette'
import { SampleDataBanner } from './SampleDataBanner'
import { Sidebar, SidebarMobile } from './Sidebar'
import { TopHeader } from './TopHeader'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'

type AdminShellProps = {
  session: AdminSession
  hasSampleData: boolean
  bare?: boolean
  children: ReactNode
}

/**
 * Phase 1 admin shell — CSS grid layout with sidebar, top header, and scrollable main.
 * Brand name comes from BrandingProvider (never hardcoded platform name in chrome).
 */
export function AdminShell({ session, hasSampleData, bare, children }: AdminShellProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, sidebarCollapsed } = useUIStore()

  if (bare) {
    return (
      <div className="min-h-screen bg-background">
        {hasSampleData ? <SampleDataBanner accountId={session.accountId} /> : null}
        {children}
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'grid h-screen overflow-hidden bg-stone-50',
          'grid-rows-[60px_1fr]',
          sidebarCollapsed
            ? 'md:grid-cols-[4rem_1fr] grid-cols-1'
            : 'md:grid-cols-[16rem_1fr] grid-cols-1',
        )}
      >
        <div className="col-start-1 row-span-2 row-start-1 hidden md:block">
          <Sidebar session={session} />
        </div>

        <div className="col-start-1 row-start-1 md:col-start-2">
          <TopHeader session={session} />
        </div>

        <div className="col-start-1 row-start-2 overflow-hidden md:col-start-2">
          {hasSampleData ? <SampleDataBanner accountId={session.accountId} /> : null}
          <main className="h-[calc(100vh-60px)] overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>

      <SidebarMobile session={session} />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  )
}

/** @deprecated Use AdminShell — kept for imports during migration */
export { AdminShell as default }
