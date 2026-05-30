import { CrmTabNav } from '@/components/operational/CrmTabNav'
import type { ReactNode } from 'react'

export default function CrmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <CrmTabNav />
      {children}
    </div>
  )
}
