import { PortalShell } from '@/components/portal/PortalShell'
import { ReactQueryProvider } from '@/components/shared/ReactQueryProvider'
import { requirePortalSession } from '@/lib/auth/require-session'
import { BrandingProvider } from '@/lib/branding/context'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { FeatureFlagProvider } from '@/lib/feature-flags/context'
import { evaluateAllFlags } from '@/lib/feature-flags/evaluate'
import type { Plan } from '@/lib/feature-flags/flags'
import { headers } from 'next/headers'
import type { ReactNode } from 'react'

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePortalSession()
  const branding = getBrandingFromHeaders(headers())
  const plan = (branding.plan === 'enterprise' ? 'enterprise' : 'team') as Plan

  let flags
  try {
    flags = await evaluateAllFlags({ accountId: session.accountId, plan })
  } catch (err) {
    console.error('[portal-layout] flag eval threw:', err)
    flags = {} as Awaited<ReturnType<typeof evaluateAllFlags>>
  }

  return (
    <BrandingProvider branding={branding}>
      <FeatureFlagProvider flags={flags}>
        <ReactQueryProvider>
          <PortalShell>{children}</PortalShell>
        </ReactQueryProvider>
      </FeatureFlagProvider>
    </BrandingProvider>
  )
}
