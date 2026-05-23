import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'
import { SampleDataBanner } from './SampleDataBanner'

type AdminShellProps = {
  session: AdminSession
  hasSampleData: boolean
  /**
   * When true, the shell renders without sidebar/topbar — children take the
   * entire viewport. Used for the onboarding wizard, which has its own
   * full-screen chrome and shouldn't be wrapped by the dashboard nav.
   */
  bare?: boolean
  /** Branding pulled from request headers — drives the sidebar logo + tints. */
  businessName: string
  logoUrl: string | null
  primaryColor: string
  aiEnabled: boolean
  children: ReactNode
}

/**
 * Dark admin chrome.
 *
 * Layout:
 *   - Fixed dark left sidebar (240px) with dot-indicator nav.
 *   - Sticky top breadcrumb bar with AI status + search affordance.
 *   - Page content area below the topbar with the deep slate base.
 *
 * Background colors are intentionally raw hex (not Tailwind tokens) so the
 * dark theme can stand on its own without interfering with the light-themed
 * shadcn primitives used elsewhere.
 */
export function AdminShell({
  session,
  hasSampleData,
  bare,
  businessName,
  logoUrl,
  primaryColor,
  aiEnabled,
  children,
}: AdminShellProps) {
  if (bare) {
    return (
      <div className="min-h-screen bg-background">
        {hasSampleData ? <SampleDataBanner accountId={session.accountId} /> : null}
        {children}
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#0A0E14] text-white">
      {/* Layered glow at the page level — a very dim radial in the top-right
          corner that subtly tints the dashboard with the brand color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 size-[40rem] opacity-[0.08] blur-3xl"
        style={{
          background: `radial-gradient(circle at top right, ${primaryColor}, transparent 65%)`,
        }}
      />

      <div className="relative flex">
        <AdminSidebar
          businessName={businessName}
          logoUrl={logoUrl}
          email={session.email}
          role={session.role}
          primaryColor={primaryColor}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar businessName={businessName} aiEnabled={aiEnabled} />
          {hasSampleData ? <SampleDataBanner accountId={session.accountId} /> : null}
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
