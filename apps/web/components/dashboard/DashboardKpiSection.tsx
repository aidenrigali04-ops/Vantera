import { KpiStrip, type KpiItem } from '@/components/operational/KpiStrip'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { DashboardSnapshot } from '@/lib/sample-data/queries'
import {
  AlertTriangle,
  TrendingUp,
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
    const atRiskClients = snapshot.clients.filter((c) => c.healthStatus === 'at_risk').length
    const priorityCount = actionFeed.length
    const periodLabel = gettingStarted ? 'Getting started' : 'Last 30d'

    return [
      {
        label: 'Needs attention',
        value: priorityCount,
        change: priorityCount > 0 ? 'Review priorities above' : 'All clear',
        trend: priorityCount > 0 ? 'down' : 'up',
        icon: AlertTriangle,
      },
      {
        label: 'Pipeline value',
        value: formatCurrency(snapshot.pipelineValueCents),
        change: periodLabel,
        trend: 'neutral',
        icon: TrendingUp,
      },
      {
        label: 'Active clients',
        value: snapshot.clients.length,
        change: atRiskClients > 0 ? `${atRiskClients} need check-in` : periodLabel,
        trend: atRiskClients > 0 ? 'down' : 'neutral',
        icon: Users,
      },
    ]
  }, [actionFeed.length, gettingStarted, snapshot])

  return <KpiStrip items={items} className="sm:grid-cols-3" />
}
