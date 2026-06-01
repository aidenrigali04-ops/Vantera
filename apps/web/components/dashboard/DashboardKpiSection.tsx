import { KpiStrip, type KpiItem } from '@/components/operational/KpiStrip'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo } from 'react'

function formatCurrency(cents: number): string {
  if (!cents) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100))
}

type Props = {
  snapshot: DashboardSnapshot
  actionFeed: ActionFeedItem[]
  gettingStarted?: boolean
}

export function DashboardKpiSection({ snapshot, actionFeed, gettingStarted = false }: Props) {
  const items = useMemo((): KpiItem[] => {
    const openDeals = snapshot.deals.filter((d) => !d.isTerminalWin && !d.isTerminalLoss)
    const closedDeals = snapshot.deals.filter((d) => d.isTerminalWin)
    const atRiskClients = snapshot.clients.filter((c) => c.healthStatus === 'at_risk').length
    const overdueTasks = actionFeed.filter((item) => item.type === 'overdue_task').length
    const periodLabel = gettingStarted ? 'Getting started' : 'Last 30d'

    return [
      {
        label: 'New leads',
        value: openDeals.length,
        change: periodLabel,
        trend: 'neutral',
        icon: UserPlus,
      },
      {
        label: 'Closed deals',
        value: closedDeals.length,
        change: snapshot.wonValueCents ? `${formatCurrency(snapshot.wonValueCents)} won` : periodLabel,
        trend: closedDeals.length > 0 ? 'up' : 'neutral',
        icon: CheckCircle2,
      },
      {
        label: 'Pipeline value',
        value: formatCurrency(snapshot.pipelineValueCents),
        change: periodLabel,
        trend: 'neutral',
        icon: TrendingUp,
      },
      {
        label: 'Churn risk',
        value: atRiskClients,
        change: atRiskClients > 0 ? 'Needs attention' : 'All clear',
        trend: atRiskClients > 0 ? 'down' : 'up',
        icon: AlertTriangle,
      },
      {
        label: 'Active clients',
        value: snapshot.clients.length,
        change: periodLabel,
        trend: 'neutral',
        icon: Users,
      },
      {
        label: 'Overdue tasks',
        value: overdueTasks,
        change: overdueTasks > 0 ? 'Act today' : 'On track',
        trend: overdueTasks > 0 ? 'down' : 'up',
        icon: Briefcase,
      },
    ]
  }, [actionFeed, gettingStarted, snapshot])

  return <KpiStrip items={items} />
}
