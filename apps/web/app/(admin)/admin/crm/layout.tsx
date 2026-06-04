import { CrmSectionLayout } from '@/components/admin/CrmSectionLayout'
import type { ReactNode } from 'react'

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <CrmSectionLayout>{children}</CrmSectionLayout>
}
