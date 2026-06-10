'use client'

import { VanteraDashboardView } from '@/components/dashboard/vantera-os/VanteraDashboardView'
import type { SdrAgentCard } from '@/lib/agents/types'
import type { RevenueProgress } from '@/components/dashboard/MrrProgressPanel'
import type { DashboardPanels } from '@/lib/dashboard/panels'
import type { OnboardingSuccessNotice } from '@/lib/import/fields'
import { onboardingSuccessStorageKey } from '@/lib/import/fields'
import { useEffect, useState } from 'react'

type DashboardClientProps = {
  email: string
  accountId: string
  panels: DashboardPanels
  onboardingIncomplete?: boolean
  isEmpty?: boolean
  sdrAgents?: SdrAgentCard[]
  revenueProgress: RevenueProgress
}

export function DashboardClient({
  email,
  accountId,
  panels,
  onboardingIncomplete = false,
  isEmpty = false,
  sdrAgents = [],
  revenueProgress,
}: DashboardClientProps) {
  const showCleanSlate = isEmpty && onboardingIncomplete
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
    <VanteraDashboardView
      email={email}
      sdrAgents={sdrAgents}
      revenueProgress={revenueProgress}
      panels={panels}
      showCleanSlate={showCleanSlate}
      successNotice={successNotice}
      onDismissSuccessNotice={dismissSuccessNotice}
    />
  )
}
