import { IntelligenceSectionLayout } from '@/components/admin/IntelligenceSectionLayout'
import type { ReactNode } from 'react'

export default function IntelligenceLayout({ children }: { children: ReactNode }) {
  return <IntelligenceSectionLayout>{children}</IntelligenceSectionLayout>
}
