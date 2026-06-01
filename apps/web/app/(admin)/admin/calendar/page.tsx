import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Calendar } from 'lucide-react'

export default function CalendarPage() {
  return (
    <ComingSoonPage
      icon={Calendar}
      title="Calendar"
      description="Team calendar for meetings, project schedules, and delivery milestones in one view."
    />
  )
}
