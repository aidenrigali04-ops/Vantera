import { AuthShell } from '@/components/auth/auth-shell'
import { UnifiedAuthClient } from '@/app/(auth)/auth/unified-auth-client'
import { resolveBrandingFromRequest } from '@/lib/auth/resolve-account'
import { BrandingProvider } from '@/lib/branding/context'
import type { BrandingData } from '@/lib/branding/context'
import { Suspense } from 'react'

/** Signup-first auth entry — used at `/` and legacy auth routes. */
export async function AuthEntryPage() {
  let branding: BrandingData

  try {
    branding = await resolveBrandingFromRequest()
  } catch {
    branding = {
      accountId: '',
      businessName: '',
      logoUrl: null,
      primaryColor: '#1648A0',
      secondaryColor: '#0D9488',
      vertical: '',
      plan: 'team',
      portalDomain: '',
      onboardingComplete: false,
      onboardingKnown: false,
    }
  }

  return (
    <BrandingProvider branding={branding}>
      <AuthShell>
        <Suspense fallback={null}>
          <UnifiedAuthClient />
        </Suspense>
      </AuthShell>
    </BrandingProvider>
  )
}
