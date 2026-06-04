'use client'

import { PortalMessagesPanel } from '@/components/portal/PortalMessagesPanel'
import { PortalPageHeader } from '@/components/portal/PortalPageHeader'
import { PortalSection } from '@/components/portal/PortalSection'
import { usePortalShell } from '@/lib/portal/context'

type PortalMessagesViewProps = {
  preview?: boolean
}

export function PortalMessagesView({ preview = false }: PortalMessagesViewProps) {
  const { workspace } = usePortalShell()
  const label = workspace.config.sections.messages.label

  return (
    <>
      <PortalPageHeader
        title={label}
        subtitle="Direct line to your account team — replies appear here in real time."
      />
      <PortalSection title="Conversation" subtitle="Send updates or questions anytime.">
        <PortalMessagesPanel messages={workspace.messages} preview={preview} />
      </PortalSection>
    </>
  )
}
