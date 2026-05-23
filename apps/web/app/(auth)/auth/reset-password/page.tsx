import { AuthLayout } from '@/components/shared/auth-layout'
import { ResetPasswordClient } from './reset-client'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <ResetPasswordClient />
    </AuthLayout>
  )
}
