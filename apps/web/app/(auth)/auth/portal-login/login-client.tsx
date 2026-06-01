'use client'

import { AuthCredentialsPanel } from '@/components/auth/auth-credentials-panel'

export function PortalLoginClient() {
  return (
    <AuthCredentialsPanel
      initialMode="login"
      showOAuth={false}
      allowModeToggle={false}
      portal
      loginFallbackPath="/portal"
      heading="Client portal"
      subheading="Sign in to view your projects, invoices, and updates."
    />
  )
}
