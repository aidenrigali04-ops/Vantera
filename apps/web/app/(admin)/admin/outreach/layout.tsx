import { OutreachSectionLayout } from '@/components/admin/OutreachSectionLayout'
import type { ReactNode } from 'react'

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return <OutreachSectionLayout>{children}</OutreachSectionLayout>
}
