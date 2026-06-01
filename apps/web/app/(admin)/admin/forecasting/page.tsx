import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { BarChart2 } from 'lucide-react'

export default function ForecastingPage() {
  return (
    <ComingSoonPage
      icon={BarChart2}
      title="Forecasting"
      description="Pipeline forecasting, revenue projections, and capacity planning."
    />
  )
}
