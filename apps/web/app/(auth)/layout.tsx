import { BrandingProvider } from '@/lib/branding/context'
import { resolveBrandingFromRequest } from '@/lib/auth/resolve-account'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await resolveBrandingFromRequest()

    return {
      title: branding.businessName ? `Sign in — ${branding.businessName}` : 'Sign in',
    }
  } catch {
    return { title: 'Sign in' }
  }
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
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
