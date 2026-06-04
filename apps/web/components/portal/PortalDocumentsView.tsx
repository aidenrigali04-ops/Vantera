'use client'

import { PortalDocumentsPanel } from '@/components/portal/PortalDocumentsPanel'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalSection } from '@/components/portal/PortalSection'
import { usePortalShell } from '@/lib/portal/context'

export function PortalDocumentsView() {
  const { workspace } = usePortalShell()
  const label = workspace.config.sections.documents.label

  return (
    <>
      <PortalPageHeader
        title={label}
        subtitle="Contracts, proposals, and files your team shares with you."
      />
      <PortalSection title="Shared files" subtitle="Download or review signed documents.">
        <PortalDocumentsPanel documents={workspace.documents} />
      </PortalSection>
    </>
  )
}
