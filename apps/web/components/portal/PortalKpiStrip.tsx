import { KpiStrip } from '@/components/operational/KpiStrip'
import { formatUsdFromCents } from '@/lib/contacts/format'
import type { PortalWorkspace } from '@/lib/portal/types'
import { CheckCircle2, FolderKanban, MessageSquare, Receipt } from 'lucide-react'

type PortalKpiStripProps = {
  workspace: PortalWorkspace
}

export function PortalKpiStrip({ workspace }: PortalKpiStripProps) {
  const activeProjects = workspace.projects.filter((p) => p.progress < 100).length
  const pendingApprovals = workspace.approvals.filter((a) => a.status === 'pending').length

  return (
    <KpiStrip
      items={[
        { label: 'Active projects', value: activeProjects, icon: FolderKanban },
        {
          label: 'Outstanding',
          value: formatUsdFromCents(workspace.billing.outstandingCents),
          icon: Receipt,
        },
        { label: 'Pending approvals', value: pendingApprovals, icon: CheckCircle2 },
        {
          label: 'Messages',
          value: workspace.unreadMessageCount > 0 ? workspace.unreadMessageCount : workspace.messages.length,
          icon: MessageSquare,
        },
      ]}
    />
  )
}
