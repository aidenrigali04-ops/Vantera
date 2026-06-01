'use client'

import { DashboardSection } from '@/components/dashboard/DashboardSection'
import { EmbeddedInsightsPanel } from '@/components/intelligence/EmbeddedInsightsPanel'
import type { EmbeddedInsight } from '@/lib/intelligence/types'

type Props = {
  insights: EmbeddedInsight[]
}

export function DashboardEmbeddedInsights({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <DashboardSection
      title="Operational intelligence"
      subtitle="AI surfaced in context — prioritize what matters next."
      action={{ label: 'All insights', href: '/admin/ai-brain' }}
    >
      <EmbeddedInsightsPanel
        insights={insights}
        title=""
        subtitle=""
        compact
      />
    </DashboardSection>
  )
}
