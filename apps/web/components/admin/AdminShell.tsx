'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { CommandPalette } from './CommandPalette'
import { MobileBottomNav } from './MobileBottomNav'
import { CsvImportModal } from '@/components/onboarding/CsvImportModal'
import { OnboardingAutoPrompt } from '@/components/onboarding/OnboardingAutoPrompt'
import { GuidedExplorationHost } from '@/components/onboarding/GuidedExplorationHost'
import { NewClientDrawer } from '@/components/onboarding/NewClientDrawer'
import { SampleDataBanner } from './SampleDataBanner'
import { Sidebar, SidebarMobile } from './Sidebar'
import { TopHeader } from './TopHeader'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'

type AdminShellProps = {
  session: AdminSession
  hasSampleData: boolean
  onboardingIncomplete?: boolean
  bare?: boolean
  children: ReactNode
}

/**
 * Phase 1 admin shell — CSS grid layout with sidebar, top header, and scrollable main.
 * Brand name comes from BrandingProvider (never hardcoded platform name in chrome).
 */
export function AdminShell({
  session,
  hasSampleData,
  onboardingIncomplete = false,
  bare,
  children,
}: AdminShellProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, sidebarCollapsed } = useUIStore()

  const showSampleExperience = hasSampleData && onboardingIncomplete

  if (bare) {
    return (
      <div className="min-h-screen bg-background">
        {showSampleExperience ? <SampleDataBanner accountId={session.accountId} /> : null}
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
          <TopHeader session={session} showDemoWorkspace={showSampleExperience} />
        </div>

        <div className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden md:col-start-2">
          {showSampleExperience ? <SampleDataBanner accountId={session.accountId} /> : null}
          <main className="min-h-0 flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
        </div>
      </div>

      <SidebarMobile session={session} />
      <MobileBottomNav />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <GuidedExplorationHost
        accountId={session.accountId}
        enabled={showSampleExperience}
      />
      <OnboardingAutoPrompt accountId={session.accountId} enabled={showSampleExperience} />
      {onboardingIncomplete ? (
        <>
          <NewClientDrawer session={session} />
          <CsvImportModal accountId={session.accountId} />
        </>
      ) : null}
    </>
  )
}

/** @deprecated Use AdminShell — kept for imports during migration */
export { AdminShell as default }
