'use client'

import { AdminSubNavRail } from '@/components/admin/AdminPageContent'
import { CrmTabNav } from '@/components/crm/CrmTabNav'
import { isAdminFullBleedPath } from '@/lib/navigation/admin-page-layout'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function CrmSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const variant = isAdminFullBleedPath(pathname) ? 'shell' : 'inset'

  return (
    <>
      <AdminSubNavRail variant={variant}>
        <CrmTabNav />
      </AdminSubNavRail>
      {children}
    </>
  )
}
