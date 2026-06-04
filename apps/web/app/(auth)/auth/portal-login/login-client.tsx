'use client'

import { AuthCredentialsPanel } from '@/components/auth/auth-credentials-panel'
import { useBranding } from '@/lib/branding/context'

export function PortalLoginClient() {
  const { businessName } = useBranding()
  const name = businessName.trim()
  const title = name ? `${name} client portal` : 'Client portal'
  const subtitle = name
    ? `Sign in with the email and password you created for your ${name} client portal.`
    : 'Sign in with the email and password from your portal invite.'

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
