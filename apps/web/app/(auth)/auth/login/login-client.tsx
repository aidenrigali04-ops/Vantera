'use client'

import { LoginForm } from '@/components/shared/login-form'
import { adminLoginAction } from '@/lib/auth/actions'
import { invokeAuthAction } from '@/lib/auth/invoke-action'

export function AdminLoginClient() {
  return (
    <LoginForm
      onSubmit={(values) =>
        invokeAuthAction(() => adminLoginAction(values), '/admin/dashboard')
      }
    />
  )
}
