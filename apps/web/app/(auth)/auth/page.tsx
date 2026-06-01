import { AuthShell } from '@/components/auth/auth-shell'
import { authPageMetadata } from '@/lib/auth/metadata'
import { Suspense } from 'react'
import { UnifiedAuthClient } from './unified-auth-client'

export const dynamic = 'force-dynamic'
export const metadata = authPageMetadata.signup

/** Canonical auth entry — defaults to signup; use ?mode=login for sign-in. */
export default function AuthPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <UnifiedAuthClient />
      </Suspense>
    </AuthShell>
  )
}
