import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { Share2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CrmOutreachPage() {
  return (
    <ModulePlaceholder
      icon={Share2}
      title="Outreach Hub"
      description="Launch LinkedIn sequences and campaigns from your Lead Pipeline without leaving Vantera."
      action={
        <Button asChild variant="outline">
          <Link href="/admin/outreach/linkedin">Open LinkedIn</Link>
        </Button>
      }
    />
  )
}
