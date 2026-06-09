'use client'

import { VentoraDashboardView } from '@/components/dashboard/ventora/VentoraDashboardView'
import type { SdrAgentCard, SdrAgentSnapshot } from '@/lib/agents/types'
import type { ActionFeedItem } from '@/lib/dashboard/action-feed'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { VentoraDashboardPayload } from '@/lib/dashboard/ventora-types'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { onboardingSuccessStorageKey } from '@/lib/import/fields'
import { useEffect, useState } from 'react'

const EMPTY_VENTORA: VentoraDashboardPayload = {
  metrics: [],
  chartData: [],
  highlightMonth: null,
  aiHeadline: '',
  aiBody: '',
  aiProgress: null,
  campaignGroups: [],
}

type DashboardClientProps = {
  email: string
  ventora?: VentoraDashboardPayload
  actionFeed: ActionFeedItem[]
  accountId: string
  onboardingIncomplete?: boolean
  isEmpty?: boolean
  sdrAgents?: SdrAgentCard[]
  sdrSnapshot?: SdrAgentSnapshot
  revenueProgress: RevenueProgress
}

export function DashboardClient({
  email,
  ventora = EMPTY_VENTORA,
  actionFeed,
  accountId,
  onboardingIncomplete = false,
  isEmpty = false,
  sdrAgents = [],
  sdrSnapshot,
  revenueProgress,
}: DashboardClientProps) {
  const showCleanSlate = isEmpty && onboardingIncomplete
  const showDemoGuide = onboardingIncomplete && !showCleanSlate
  const [successNotice, setSuccessNotice] = useState<OnboardingSuccessNotice | null>(null)

  useEffect(() => {
    const raw = window.sessionStorage.getItem(onboardingSuccessStorageKey(accountId))
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.kind && typeof parsed.kind === 'string') {
        setSuccessNotice(parsed as OnboardingSuccessNotice)
        return
      }
      if (parsed.entity && typeof parsed.count === 'number') {
        setSuccessNotice({
          kind: 'import',
          entity: parsed.entity as Extract<OnboardingSuccessNotice, { kind: 'import' }>['entity'],
          count: parsed.count,
        })
      }
    } catch {
      window.sessionStorage.removeItem(onboardingSuccessStorageKey(accountId))
    }
  }, [accountId])

  function dismissSuccessNotice() {
    window.sessionStorage.removeItem(onboardingSuccessStorageKey(accountId))
    setSuccessNotice(null)
  }

  return (
    <>
      <VentoraDashboardView
        ventora={ventora}
        email={email}
        actionFeed={actionFeed}
        sdrAgents={sdrAgents}
        sdrSnapshot={sdrSnapshot}
        revenueProgress={revenueProgress}
        showCleanSlate={showCleanSlate}
        showDemoGuide={showDemoGuide}
        successNotice={successNotice}
        onDismissSuccessNotice={dismissSuccessNotice}
      />
    </>
  )
}
