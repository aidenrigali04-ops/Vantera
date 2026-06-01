import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { PieChart } from 'lucide-react'

export default function ReportsPage() {
  return (
    <ComingSoonPage
      icon={PieChart}
      title="Reports"
      description="Operational and revenue reporting across pipeline, delivery, and client health."
    />
  )
}
