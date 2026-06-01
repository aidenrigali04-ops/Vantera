'use client'

import { AuthCredentialsPanel } from '@/components/auth/auth-credentials-panel'
import { resolveAuthModeFromSearch } from '@/lib/auth/resolve-auth-mode'
import { usePathname, useSearchParams } from 'next/navigation'

export function UnifiedAuthClient() {
  const pathname = usePathname() ?? '/auth'
  const searchParams = useSearchParams()
  const initialMode = resolveAuthModeFromSearch(searchParams?.get('mode') ?? null, pathname)

  return <AuthCredentialsPanel initialMode={initialMode} />
}
