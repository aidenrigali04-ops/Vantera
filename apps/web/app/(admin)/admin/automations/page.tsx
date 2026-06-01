import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Zap } from 'lucide-react'

export default function AutomationsPage() {
  return (
    <ComingSoonPage
      icon={Zap}
      title="Automations"
      description="Trigger-based workflows for stage changes, follow-ups, and operational handoffs."
    />
  )
}
