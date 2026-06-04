'use client'

import type { PortalNavCounts, PortalWorkspace } from '@/lib/portal/types'
import { createContext, useContext, type ReactNode } from 'react'

export type PortalShellContextValue = {
  workspace: PortalWorkspace
  navCounts: PortalNavCounts
  preview: boolean
  /** When previewing from admin, used for sidebar deep links */
  previewContactId: string | null
}

const PortalShellContext = createContext<PortalShellContextValue | null>(null)

export function PortalShellProvider({
  value,
  children,
}: {
  value: PortalShellContextValue
  children: ReactNode
}) {
  return <PortalShellContext.Provider value={value}>{children}</PortalShellContext.Provider>
}

export function usePortalShell(): PortalShellContextValue {
  const ctx = useContext(PortalShellContext)
  if (!ctx) {
    throw new Error('usePortalShell must be used within PortalShellProvider')
  }
  return ctx
}
