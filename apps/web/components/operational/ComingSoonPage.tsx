import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModulePlaceholder } from '@/components/operational/ModulePlaceholder'
import { PageHeader } from '@/components/operational/PageHeader'

type ComingSoonPageProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

/** Consistent placeholder for modules on the platform roadmap. */
export function ComingSoonPage({ icon, title, description, action }: ComingSoonPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description="This module is on the platform roadmap." />
      <ModulePlaceholder
        icon={icon}
        title={`${title} coming soon`}
        description={description}
        action={action}
      />
    </div>
  )
}
