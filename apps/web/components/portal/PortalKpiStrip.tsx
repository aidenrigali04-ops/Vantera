import { KpiStrip } from '@/components/operational/KpiStrip'
import type { PortalWorkspace } from '@/lib/portal/types'
import { CheckCircle2, Clock, FolderKanban } from 'lucide-react'

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
        { label: 'Pending approvals', value: pendingApprovals, icon: CheckCircle2 },
        { label: 'Recent updates', value: workspace.activities.length, icon: Clock },
      ]}
    />
  )
}
