'use client'

import { LoginForm } from '@/components/shared/login-form'
import { portalLoginAction } from '@/lib/auth/actions'

export function PortalLoginClient() {
  return (
    <LoginForm
      heading="Client portal"
      subheading="Sign in to view your projects, invoices, and updates."
      showOAuth={false}
      onSubmit={async (values) => {
        const result = await portalLoginAction(values)

        if (!result.success) {
          return { success: false, error: result.error }
        }

        return { success: true, redirectTo: result.data.redirectTo }
      }}
    />
  )
}
