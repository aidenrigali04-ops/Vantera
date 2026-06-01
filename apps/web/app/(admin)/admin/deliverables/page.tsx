import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Package } from 'lucide-react'

export default function DeliverablesPage() {
  return (
    <ComingSoonPage
      icon={Package}
      title="Deliverables"
      description="Track files, approvals, and client-facing outputs across active projects."
    />
  )
}
