import { AdminShell } from '@/components/admin/AdminShell'
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
import { isAiEnabled } from '@/lib/ai'
import { requireAdminSession } from '@/lib/auth/require-session'
import { BrandingProvider } from '@/lib/branding/context'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { FeatureFlagProvider } from '@/lib/feature-flags/context'
import { evaluateAllFlags } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { hasSampleDataForAccount } from '@/lib/sample-data/queries'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())
  const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan

  const pathname = headers().get('x-pathname') ?? ''
  const isOnboardingRoute = pathname.startsWith('/admin/onboarding')

  // Final-layer onboarding gate. Middleware ALSO enforces this, but the
  // layout-level guard means we're safe even if:
  //   - the middleware matcher ever gets narrowed,
  //   - Vercel's edge serves a stale response,
  //   - the request bypasses middleware entirely (rare but possible during
  //     deployment swaps).
  // Owners with onboarding_completed_at = NULL get redirected back to the
  // wizard; non-owner roles never see the wizard so they bypass.
  if (
    session.role === 'owner' &&
    !branding.onboardingComplete &&
    !isOnboardingRoute
  ) {
    redirect('/admin/onboarding')
  }

  let flags
  try {
    flags = await evaluateAllFlags({ accountId: session.accountId, plan })
  } catch (err) {
    console.error('[admin-layout] flag eval threw:', err)
    flags = {} as Awaited<ReturnType<typeof evaluateAllFlags>>
  }

  let hasSampleData = false
  if (!isOnboardingRoute) {
    try {
      if (branding.accountId) {
        hasSampleData = await hasSampleDataForAccount(branding.accountId)
      }
    } catch (err) {
      console.error('[admin-layout] sample data check threw:', err)
    }
  }

  return (
    <BrandingProvider branding={branding}>
      <FeatureFlagProvider flags={flags}>
        <ReactQueryProvider>
          <AdminShell
            session={session}
            hasSampleData={hasSampleData}
            bare={isOnboardingRoute}
            businessName={branding.businessName || 'Your workspace'}
            logoUrl={branding.logoUrl}
            primaryColor={branding.primaryColor || '#1648A0'}
            aiEnabled={isAiEnabled()}
          >
            {children}
          </AdminShell>
        </ReactQueryProvider>
      </FeatureFlagProvider>
    </BrandingProvider>
  )
}
