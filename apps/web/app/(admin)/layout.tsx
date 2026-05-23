import { AdminShell } from '@/components/admin/AdminShell'
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
import { requireAdminSession } from '@/lib/auth/require-session'
import { BrandingProvider } from '@/lib/branding/context'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { FeatureFlagProvider } from '@/lib/feature-flags/context'
import { evaluateAllFlags } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())
  const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan
  const pathname = headers().get('x-pathname') ?? ''

  // Onboarding redirect runs before flag eval so a missing/slow DB never blocks
  // the bounce. We only redirect when we have a real branding payload — if
  // middleware couldn't resolve the tenant, branding.accountId is empty and
  // we shouldn't bounce the user into a wizard they can't actually finish.
  if (
    branding.accountId &&
    !branding.onboardingComplete &&
    pathname !== '/admin/onboarding'
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

  return (
    <BrandingProvider branding={branding}>
      <FeatureFlagProvider flags={flags}>
        <ReactQueryProvider>
          <AdminShell session={session}>{children}</AdminShell>
        </ReactQueryProvider>
      </FeatureFlagProvider>
    </BrandingProvider>
  )
}
