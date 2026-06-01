import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Mail } from 'lucide-react'

export default function EmailMarketingPage() {
  return (
    <ComingSoonPage
      icon={Mail}
      title="Email Marketing"
      description="Campaigns, sequences, and nurture flows for prospects and active clients."
    />
  )
}
