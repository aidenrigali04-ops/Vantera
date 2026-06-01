import { AuthShell } from '@/components/auth/auth-shell'
import { resolveBrandingFromRequest } from '@/lib/auth/resolve-account'
import { portalLoginMetadata } from '@/lib/auth/metadata'
import { Suspense } from 'react'
import { PortalLoginClient } from './login-client'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  try {
    const branding = await resolveBrandingFromRequest()
    return portalLoginMetadata(branding.businessName)
  } catch {
    return portalLoginMetadata(null)
  }
}

export default function PortalLoginPage() {
  return (
    <AuthShell showBrandPanel={false}>
      <Suspense fallback={null}>
        <PortalLoginClient />
      </Suspense>
    </AuthShell>
  )
}
