'use client'

import { SdrModuleActivationClient } from '@/components/sdr/SdrModuleActivationClient'
import { SdrSetupWizardClient } from '@/components/sdr/SdrSetupWizardClient'
import type { Plan } from '@/lib/feature-flags/flags'
import { useState } from 'react'

type Props = {
  sdrEnabled: boolean
  isOwner: boolean
  plan: Plan
  accountVertical: string
  accountName: string
}

export function SdrAgentSetupFlow({
  sdrEnabled: initialEnabled,
  isOwner,
  plan,
  accountVertical,
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

  return <SdrSetupWizardClient accountVertical={accountVertical} />
}
