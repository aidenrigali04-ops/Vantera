'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { CommandPalette } from './CommandPalette'
import { MobileBottomNav } from './MobileBottomNav'
import { CsvImportModal } from '@/components/onboarding/CsvImportModal'
import { OnboardingAutoPrompt } from '@/components/onboarding/OnboardingAutoPrompt'
import { GuidedExplorationHost } from '@/components/onboarding/GuidedExplorationHost'
import { ProductTourHost } from '@/components/onboarding/product-tour/ProductTourHost'
import { NewClientDrawer } from '@/components/onboarding/NewClientDrawer'
import { HubRelatedStrip } from '@/components/navigation/HubRelatedStrip'
import { SampleDataBanner } from './SampleDataBanner'
import { Sidebar, SidebarMobile } from './Sidebar'
import { TopHeader } from './TopHeader'
import { WorkspaceMain } from './WorkspaceMain'
import { useUIStore } from '@/lib/stores/ui-store'
import { cn } from '@/lib/utils'

type AdminShellProps = {
  session: AdminSession
  hasSampleData: boolean
  onboardingIncomplete?: boolean
  bare?: boolean
  /** Allow page content to span full width (tables, kanban). */
  workspaceFullBleed?: boolean
  children: ReactNode
}

/**
 * Ventaro application shell — Step 1 global layout.
 * Sidebar (240px) + workspace header + scrollable main canvas.
 */
export function AdminShell({
  session,
  hasSampleData,
  onboardingIncomplete = false,
  bare,
  workspaceFullBleed = false,
  children,
}: AdminShellProps) {
  const { commandPaletteOpen, setCommandPaletteOpen, sidebarCollapsed } = useUIStore()

  const showSampleExperience = hasSampleData && onboardingIncomplete

  if (bare) {
    return (
      <div className="min-h-screen bg-[#fafaf9]">
        {showSampleExperience ? <SampleDataBanner accountId={session.accountId} /> : null}
        {children}
      </div>
    )
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
          <TopHeader session={session} showDemoWorkspace={showSampleExperience} />
        </div>

        <div className="col-start-1 row-start-2 flex min-h-0 flex-col overflow-hidden md:col-start-2">
          {showSampleExperience ? <SampleDataBanner accountId={session.accountId} /> : null}
          <HubRelatedStrip />
          <WorkspaceMain constrained={!workspaceFullBleed}>{children}</WorkspaceMain>
        </div>
      </div>

      <SidebarMobile session={session} />
      <MobileBottomNav />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <ProductTourHost accountId={session.accountId} enabled={session.role === 'owner'} />
      <GuidedExplorationHost accountId={session.accountId} enabled={showSampleExperience} deferUntilProductTour />
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
