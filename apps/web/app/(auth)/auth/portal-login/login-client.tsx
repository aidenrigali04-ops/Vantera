'use client'

import { AuthCredentialsPanel } from '@/components/auth/auth-credentials-panel'
import { useBranding } from '@/lib/branding/context'

export function PortalLoginClient() {
  const { businessName } = useBranding()
  const name = businessName.trim()
  const title = name ? `${name} client portal` : 'Client portal'
  const subtitle = name
    ? `Sign in to view your projects, invoices, and updates from ${name}.`
    : 'Sign in to view your projects, invoices, and updates.'

  return (
    <AuthCredentialsPanel
      initialMode="login"
      showOAuth={false}
      allowModeToggle={false}
      portal
      loginFallbackPath="/portal"
      heading={title}
      subheading={subtitle}
    />
  )
}
