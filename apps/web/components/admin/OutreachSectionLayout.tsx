'use client'

import { AdminSubNavRail } from '@/components/admin/AdminPageContent'
import { OutreachSubNav } from '@/components/operational/OutreachSubNav'
import { isAdminFullBleedPath } from '@/lib/navigation/admin-page-layout'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function OutreachSectionLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const variant = isAdminFullBleedPath(pathname) ? 'shell' : 'inset'

  return (
    <>
      <AdminSubNavRail variant={variant}>
        <OutreachSubNav />
      </AdminSubNavRail>
      {children}
    </>
  )
}
