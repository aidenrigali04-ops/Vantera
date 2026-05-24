'use client'

import { LoginForm } from '@/components/shared/login-form'
import { portalLoginAction } from '@/lib/auth/actions'
import { invokeAuthAction } from '@/lib/auth/invoke-action'

export function PortalLoginClient() {
  return (
    <LoginForm
      heading="Client portal"
      subheading="Sign in to view your projects, invoices, and updates."
      showOAuth={false}
      onSubmit={(values) => invokeAuthAction(() => portalLoginAction(values), '/portal')}
    />
  )
}
