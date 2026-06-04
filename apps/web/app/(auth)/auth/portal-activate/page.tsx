import { AuthShell } from '@/components/auth/auth-shell'
import { BrandingProvider } from '@/lib/branding/context'
import { portalLoginMetadata } from '@/lib/auth/metadata'
import { resolvePortalBranding } from '@/lib/auth/resolve-account'
import { getPortalActivatePreview } from '@/lib/portal/portal-auth-actions'
import { Suspense } from 'react'
import { PortalActivateClient } from './portal-activate-client'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: { workspace?: string; token?: string }
}

export async function generateMetadata({ searchParams }: Props) {
  try {
    const branding = await resolvePortalBranding(searchParams.workspace)
    return portalLoginMetadata(branding.businessName)
  } catch {
    return portalLoginMetadata(null)
  }
}

export default async function PortalActivatePage({ searchParams }: Props) {
  const branding = await resolvePortalBranding(searchParams.workspace)
  const token = searchParams.token?.trim() ?? ''

  let preview: {
    email: string
    accountName: string
    hasExistingAccount: boolean
  } | null = null
  let previewError: string | null = null

  if (token) {
    const result = await getPortalActivatePreview(token)
    if (result.success) {
      preview = result.data
    } else {
      previewError = result.error ?? 'This invite link is invalid or has expired.'
    }
  } else {
    previewError = 'Missing invite link. Open the link from your portal invite email.'
  }

  return (
    <BrandingProvider branding={branding} applyBrandAccent>
      <AuthShell showBrandPanel={false} portal>
        <Suspense fallback={null}>
          <PortalActivateClient
            token={token}
            preview={preview}
            previewError={previewError}
          />
        </Suspense>
      </AuthShell>
    </BrandingProvider>
  )
}
