import { BrandingProvider } from '@/lib/branding/context'
import { resolveBrandingFromRequest } from '@/lib/auth/resolve-account'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await resolveBrandingFromRequest()

  return {
    title: branding.businessName ? `Sign in — ${branding.businessName}` : 'Sign in',
  }
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const branding = await resolveBrandingFromRequest()

  return <BrandingProvider branding={branding}>{children}</BrandingProvider>
}
