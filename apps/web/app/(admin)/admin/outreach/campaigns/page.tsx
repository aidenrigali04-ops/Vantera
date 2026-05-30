import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { Megaphone } from 'lucide-react'

export default function CampaignsPage() {
  return (
    <ModulePlaceholder
      icon={Megaphone}
      title="Campaigns"
      description="Multi-channel outreach campaigns across LinkedIn, email, and sequences."
    />
  )
}
