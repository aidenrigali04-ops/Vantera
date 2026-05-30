import type { ReactNode } from 'react'
import { AuthBrandPanel } from './auth-brand-panel'
import { AuthLogo } from './auth-logo'

type AuthShellProps = {
  children: ReactNode
}

/**
 * Two-column auth shell per UX spec:
 * - Left: form (full width on mobile)
 * - Right: brand panel (hidden on mobile)
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
        <AuthLogo className="mb-10 lg:mb-12" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </div>
      <AuthBrandPanel />
    </div>
  )
}
