import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { Telescope } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CrmProspectingPage() {
  return (
    <ModulePlaceholder
      icon={Telescope}
      title="Prospecting"
      description="Discover and enrich leads via Aspire, then add them directly to your Lead Pipeline."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/outreach/aspire">Open Aspire</Link>
        </Button>
      }
    />
  )
}
