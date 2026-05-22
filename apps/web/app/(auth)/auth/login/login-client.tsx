'use client'

import { LoginForm } from '@/components/shared/login-form'
import { adminLoginAction } from '@/lib/auth/actions'

export function AdminLoginClient() {
  return (
    <LoginForm
      onSubmit={async (values) => {
        const result = await adminLoginAction(values)

        if (!result.success) {
          return { success: false, error: result.error }
        }

        return { success: true, redirectTo: result.data.redirectTo }
      }}
    />
  )
}
