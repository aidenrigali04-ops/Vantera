'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'

type AdminShellProps = {
  session: AdminSession
  children: ReactNode
}

export function AdminShell({ children }: AdminShellProps) {
  return <div className="flex h-screen">{children}</div>
}
