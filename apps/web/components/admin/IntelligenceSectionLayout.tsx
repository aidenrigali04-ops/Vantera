'use client'

import { AdminSubNavRail } from '@/components/admin/AdminPageContent'
import { IntelligenceTabNav } from '@/components/operational/IntelligenceTabNav'
import { isAdminFullBleedPath } from '@/lib/navigation/admin-page-layout'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function IntelligenceSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const variant = isAdminFullBleedPath(pathname) ? 'shell' : 'inset'

  return (
    <>
      <AdminSubNavRail variant={variant}>
        <IntelligenceTabNav />
      </AdminSubNavRail>
      {children}
    </>
  )
}
