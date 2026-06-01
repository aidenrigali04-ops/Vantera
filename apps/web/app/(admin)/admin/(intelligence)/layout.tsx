import { IntelligenceTabNav } from '@/components/operational/IntelligenceTabNav'
import type { ReactNode } from 'react'

export default function IntelligenceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <IntelligenceTabNav />
      {children}
    </div>
  )
}
