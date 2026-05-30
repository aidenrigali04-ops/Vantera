import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { Inbox } from 'lucide-react'

export default function CrmInboxPage() {
  return (
    <ModulePlaceholder
      icon={Inbox}
      title="CRM Inbox"
      description="Unified inbox for lead and client communications across email, LinkedIn, and portal messages."
    />
  )
}
