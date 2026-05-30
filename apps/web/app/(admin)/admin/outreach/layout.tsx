import { OutreachSubNav } from '@/components/operational/OutreachSubNav'
import type { ReactNode } from 'react'

export default function OutreachLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <OutreachSubNav />
      {children}
    </div>
  )
}
