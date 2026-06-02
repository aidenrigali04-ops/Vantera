'use client'

import type { ReactNode } from 'react'

type PortalShellProps = {
  children: ReactNode
}

/** Client portal root — design-token canvas, full-height scroll. */
export function PortalShell({ children }: PortalShellProps) {
  return <div className="min-h-[100dvh] bg-[var(--bg-base)] text-[var(--text-primary)]">{children}</div>
}
