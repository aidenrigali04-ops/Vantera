import { AdminShell } from '@/components/admin/AdminShell'
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
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

  // No more forced redirect to a setup wizard. New accounts are seeded
  // with a sample workspace at signup time and onboarding_completed_at
  // is set immediately. Configuration (branding, integrations, team)
  // moves into in-app settings rather than blocking the first session.

  let flags
  try {
    flags = await evaluateAllFlags({ accountId: session.accountId, plan })
  } catch (err) {
    console.error('[admin-layout] flag eval threw:', err)
    flags = {} as Awaited<ReturnType<typeof evaluateAllFlags>>
  }

  let hasSampleData = false
  try {
    if (branding.accountId) {
      hasSampleData = await hasSampleDataForAccount(branding.accountId)
    }
  } catch (err) {
    console.error('[admin-layout] sample data check threw:', err)
  }

  return (
    <BrandingProvider branding={branding}>
      <FeatureFlagProvider flags={flags}>
        <ReactQueryProvider>
          <AdminShell session={session} hasSampleData={hasSampleData}>
            {children}
          </AdminShell>
        </ReactQueryProvider>
      </FeatureFlagProvider>
    </BrandingProvider>
  )
}
