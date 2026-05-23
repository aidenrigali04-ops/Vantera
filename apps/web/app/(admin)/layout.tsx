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
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())
  const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan

  // Owners with an incomplete onboarding state are gated to the wizard
  // by the middleware; we don't redirect from here. The pathname header
  // (set by middleware) is used below to skip chrome that doesn't make
  // sense during onboarding (sample-data banner, etc).
  const pathname = headers().get('x-pathname') ?? ''
  const isOnboardingRoute = pathname.startsWith('/admin/onboarding')

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
