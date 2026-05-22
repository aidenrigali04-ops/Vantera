'use client'

import type { ReactNode } from 'react'

type PortalShellProps = {
  children: ReactNode
}

export function PortalShell({ children }: PortalShellProps) {
  return <div className="min-h-screen bg-background">{children}</div>
}
