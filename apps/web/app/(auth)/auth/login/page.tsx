import { AuthShell } from '@/components/auth/auth-shell'
import { authPageMetadata } from '@/lib/auth/metadata'
import { Suspense } from 'react'
import { UnifiedAuthClient } from '../unified-auth-client'

export const metadata = authPageMetadata.login

export default function AdminLoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <UnifiedAuthClient />
      </Suspense>
    </AuthShell>
  )
}
