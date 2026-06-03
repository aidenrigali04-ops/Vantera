import { AuthShell } from '@/components/auth/auth-shell'
import { BrandingProvider } from '@/lib/branding/context'
import { portalLoginMetadata } from '@/lib/auth/metadata'
import { resolvePortalBranding } from '@/lib/auth/resolve-account'
import { Suspense } from 'react'
import { PortalLoginClient } from './login-client'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: { workspace?: string }
}

export async function generateMetadata({ searchParams }: Props) {
  try {
    const branding = await resolvePortalBranding(searchParams.workspace)
    return portalLoginMetadata(branding.businessName)
  } catch {
    return portalLoginMetadata(null)
  }
}

export default async function PortalLoginPage({ searchParams }: Props) {
  const branding = await resolvePortalBranding(searchParams.workspace)

  return (
    <BrandingProvider branding={branding} applyBrandAccent>
      <AuthShell showBrandPanel={false} portal>
        <Suspense fallback={null}>
          <PortalLoginClient />
        </Suspense>
      </AuthShell>
    </BrandingProvider>
  )
}
