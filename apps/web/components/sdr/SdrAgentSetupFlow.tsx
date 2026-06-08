'use client'

import { ProspectScoutAgentWorkspace } from '@/components/agents/workspaces/ProspectScoutAgentWorkspace'
import { SdrModuleActivationClient } from '@/components/sdr/SdrModuleActivationClient'
import type { Plan } from '@/lib/feature-flags/flags'
import { useState } from 'react'

type Props = {
  sdrEnabled: boolean
  isOwner: boolean
  plan: Plan
  accountVertical: string
  accountName: string
  accountId: string
}

export function SdrAgentSetupFlow({
  sdrEnabled: initialEnabled,
  isOwner,
  plan,
  accountVertical,
  accountId,
}: Props) {
  const [sdrEnabled, setSdrEnabled] = useState(initialEnabled)

  if (!sdrEnabled) {
    return (
      <SdrModuleActivationClient
        isOwner={isOwner}
        plan={plan}
        onActivated={() => setSdrEnabled(true)}
      />
    )
  }

  return (
    <ProspectScoutAgentWorkspace
      mode="setup"
      accountId={accountId}
      accountVertical={accountVertical}
      config={null}
      aspirePayload={null}
      stats={null}
      initialActivity={[]}
    />
  )
}
