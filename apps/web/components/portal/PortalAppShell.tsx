'use client'

import { PortalSidebar } from '@/components/portal/PortalSidebar'
import { PortalShellProvider, type PortalShellContextValue } from '@/lib/portal/context'
import { useBranding } from '@/lib/branding/context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

type PortalAppShellProps = {
  shell: PortalShellContextValue
  children: ReactNode
  /** Poll for CRM updates (messages, invoices, projects). Off in admin preview. */
  liveRefresh?: boolean
}

export function PortalAppShell({
  shell,
  children,
  liveRefresh = true,
}: PortalAppShellProps) {
  const router = useRouter()
  const { primaryColor } = useBranding()
  const [mobileOpen, setMobileOpen] = useState(false)
  const shouldPoll = liveRefresh && !shell.preview

  useEffect(() => {
    if (!shouldPoll) return
    const id = window.setInterval(() => router.refresh(), 30_000)
    return () => window.clearInterval(id)
  }, [router, shouldPoll])

  return (
    <PortalShellProvider value={shell}>
      <div className="flex min-h-[100dvh]">
        <PortalSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className="h-1 shrink-0 md:hidden"
            style={{ backgroundColor: primaryColor }}
            aria-hidden
          />
          <main className="flex-1 overflow-y-auto px-4 py-6 pt-16 md:px-8 md:py-8 md:pt-8">
            <div className="mx-auto max-w-[1280px]">{children}</div>
          </main>
        </div>
      </div>
    </PortalShellProvider>
  )
}
