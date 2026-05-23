'use client'

import type { AdminSession } from '@/lib/auth/types'
import type { ReactNode } from 'react'
import { SampleDataBanner } from './SampleDataBanner'

type AdminShellProps = {
  session: AdminSession
  hasSampleData: boolean
  children: ReactNode
}

export function AdminShell({ session, hasSampleData, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {hasSampleData ? <SampleDataBanner accountId={session.accountId} /> : null}
      <div className="flex-1">{children}</div>
    </div>
  )
}
