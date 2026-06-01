import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Inbox } from 'lucide-react'

export default function InboxPage() {
  return (
    <ComingSoonPage
      icon={Inbox}
      title="Inbox"
      description="Unified inbox for replies, notifications, and client messages — connected to pipeline and delivery."
    />
  )
}
