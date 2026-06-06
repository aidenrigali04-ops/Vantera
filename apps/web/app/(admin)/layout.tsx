import { AdminShell } from '@/components/admin/AdminShell'
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
import { requireAdminSession } from '@/lib/auth/require-session'
import { BrandingProvider } from '@/lib/branding/context'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { FeatureFlagProvider } from '@/lib/feature-flags/context'
import { evaluateAllFlags } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'
import { shouldRedirectOwnerToOnboarding } from '@/lib/onboarding/admin-access'
import { isOnboardingCompleteForAccount } from '@/lib/onboarding/status'
import { isAdminFullBleedPath } from '@/lib/navigation/admin-page-layout'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())
  const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan

  const brandingMatchesSession =
    !branding.accountId || String(branding.accountId) === String(session.accountId)

  let onboardingComplete = true
  if (session.role === 'owner') {
    if (brandingMatchesSession && branding.onboardingKnown) {
      onboardingComplete = branding.onboardingComplete
    } else {
      onboardingComplete = await isOnboardingCompleteForAccount(session.accountId)
    }
  }

  let flags
  try {
    flags = await evaluateAllFlags({ accountId: session.accountId, plan })
  } catch (err) {
    console.error('[admin-layout] flag eval threw:', err)
    flags = {} as Awaited<ReturnType<typeof evaluateAllFlags>>
  }

  const pathname = headers().get('x-pathname') ?? ''
  const isOnboardingWizard = pathname.startsWith('/admin/onboarding')
  const isSdrSetupWizard = pathname.startsWith('/admin/outreach/agents/setup')
  const workspaceFullBleed = isAdminFullBleedPath(pathname)

  if (
    shouldRedirectOwnerToOnboarding({
      role: session.role,
      onboardingComplete,
      pathname,
    })
  ) {
    redirect(AUTH_ONBOARDING_PATH)
  }

  if (isOnboardingWizard || isSdrSetupWizard) {
    return (
      <BrandingProvider branding={branding}>
        <FeatureFlagProvider flags={flags}>
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </FeatureFlagProvider>
      </BrandingProvider>
    )
  }

  return (
    <BrandingProvider branding={branding}>
      <FeatureFlagProvider flags={flags}>
        <ReactQueryProvider>
          <AdminShell
            session={session}
            onboardingIncomplete={session.role === 'owner' && !onboardingComplete}
            workspaceFullBleed={workspaceFullBleed}
          >
            {children}
          </AdminShell>
        </ReactQueryProvider>
      </FeatureFlagProvider>
    </BrandingProvider>
  )
}
