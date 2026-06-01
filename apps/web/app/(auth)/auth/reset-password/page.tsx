import { AuthShell } from '@/components/auth/auth-shell'
import { authPageMetadata } from '@/lib/auth/metadata'
import { ResetPasswordClient } from './reset-client'

export const dynamic = 'force-dynamic'
export const metadata = authPageMetadata.resetPassword

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <ResetPasswordClient />
    </AuthShell>
  )
}
