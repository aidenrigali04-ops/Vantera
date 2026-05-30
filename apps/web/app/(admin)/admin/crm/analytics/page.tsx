import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { BarChart2 } from 'lucide-react'

export default function CrmAnalyticsPage() {
  return (
    <ModulePlaceholder
      icon={BarChart2}
      title="CRM Analytics"
      description="Pipeline metrics, conversion rates, and operational reporting for leads and active clients."
    />
  )
}
