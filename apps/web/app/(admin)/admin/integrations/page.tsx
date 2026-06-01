import { ComingSoonPage } from '@/components/operational/ComingSoonPage'
import { Button } from '@/components/ui/button'
import { Plug } from 'lucide-react'
import Link from 'next/link'

export default function IntegrationsPage() {
  return (
    <ComingSoonPage
      icon={Plug}
      title="Integrations"
      description="Connect Stripe, Twilio, QuickBooks, Google Calendar, HubSpot, and other tools to your workspace."
      action={
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/settings">Workspace settings →</Link>
        </Button>
      }
    />
  )
}
