import { BrandingProvider } from '@/lib/branding/context'
import { resolveBrandingFromRequest } from '@/lib/auth/resolve-account'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function AuthRouteLayout({ children }: { children: ReactNode }) {
  let branding

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

  return <BrandingProvider branding={branding}>{children}</BrandingProvider>
}
