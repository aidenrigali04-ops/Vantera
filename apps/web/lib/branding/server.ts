import type { BrandingData } from '@/lib/branding/context'
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers'

export function getBrandingFromHeaders(headers: ReadonlyHeaders): BrandingData {
  const logoUrl = headers.get('x-brand-logo-url')

  return {
    accountId: headers.get('x-account-id') ?? '',
    businessName: headers.get('x-brand-name') ?? '',
    logoUrl: logoUrl || null,
    primaryColor: headers.get('x-brand-primary') ?? '#1648A0',
    secondaryColor: headers.get('x-brand-secondary') ?? '#0D9488',
    vertical: headers.get('x-account-vertical') ?? '',
    plan: headers.get('x-account-plan') ?? 'team',
    portalDomain: headers.get('x-portal-domain') ?? '',
    onboardingComplete: headers.get('x-onboarding-complete') === 'true',
  }
}
