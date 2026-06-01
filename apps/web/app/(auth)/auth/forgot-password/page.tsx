import { AuthShell } from '@/components/auth/auth-shell'
import { authPageMetadata } from '@/lib/auth/metadata'
import { Suspense } from 'react'
import { ForgotPasswordClient } from './forgot-client'

export const dynamic = 'force-dynamic'
export const metadata = authPageMetadata.forgotPassword

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordClient />
    </AuthShell>
  )
}
