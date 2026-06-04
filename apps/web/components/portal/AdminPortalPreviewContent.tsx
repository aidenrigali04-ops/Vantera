'use client'

import { PortalActivityView } from '@/components/portal/PortalActivityView'
import { PortalBillingView } from '@/components/portal/PortalBillingView'
import { PortalDocumentsView } from '@/components/portal/PortalDocumentsView'
import { PortalMessagesView } from '@/components/portal/PortalMessagesView'
import { PortalOverviewView } from '@/components/portal/PortalOverviewView'
import { PortalProjectsView } from '@/components/portal/PortalProjectsView'
import type { PortalSectionId } from '@/lib/portal/config'
import { PORTAL_SECTION_IDS } from '@/lib/portal/config'
import { useSearchParams } from 'next/navigation'

function parseView(raw: string | null): PortalSectionId {
  if (raw && (PORTAL_SECTION_IDS as readonly string[]).includes(raw)) {
    return raw as PortalSectionId
  }
  return 'overview'
}

export function AdminPortalPreviewContent() {
  const searchParams = useSearchParams()
  const view = parseView(searchParams.get('view'))

  switch (view) {
    case 'projects':
      return <PortalProjectsView />
    case 'messages':
      return <PortalMessagesView preview />
    case 'billing':
      return <PortalBillingView />
    case 'documents':
      return <PortalDocumentsView />
    case 'activity':
      return <PortalActivityView />
    case 'overview':
    default:
      return <PortalOverviewView preview />
  }
}
