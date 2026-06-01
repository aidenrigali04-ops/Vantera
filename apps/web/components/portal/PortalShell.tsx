'use client'

import type { ReactNode } from 'react'

type PortalShellProps = {
  children: ReactNode
}

/** Client portal root — warm canvas, full-height scroll. */
export function PortalShell({ children }: PortalShellProps) {
  return <div className="min-h-[100dvh] bg-[#fafaf9]">{children}</div>
}
