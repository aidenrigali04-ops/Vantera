'use client'

import { PortalActivityFeed } from '@/components/portal/PortalActivityFeed'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalSection } from '@/components/portal/PortalSection'
import { usePortalShell } from '@/lib/portal/context'

export function PortalActivityView() {
  const { workspace } = usePortalShell()
  const label = workspace.config.sections.activity.label

  return (
    <>
      <PortalPageHeader
        title={label}
        subtitle="Timeline of updates your team publishes to your workspace."
      />
      <PortalSection title="Timeline" subtitle="Newest activity first.">
        <PortalActivityFeed activities={workspace.activities} />
      </PortalSection>
    </>
  )
}
