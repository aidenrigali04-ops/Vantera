import { AuthLayout } from '@/components/shared/auth-layout'
import { ForgotPasswordClient } from './forgot-client'

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <ForgotPasswordClient />
    </AuthLayout>
  )
}
