'use client'

import { SdrCreditPaywall } from '@/components/sdr/SdrCreditPaywall'
import { SdrCreditStrip } from '@/components/sdr/SdrCreditStrip'
import { useSdrCredits } from '@/lib/sdr/use-sdr-credits'
import { useEffect, useState } from 'react'

type Props = {
  children?: React.ReactNode
}

/** SDR outreach hub chrome — tabs + credit strip for pipeline and related views. */
export function SdrPipelineHubChrome({ children }: Props) {
  const [paywallOpen, setPaywallOpen] = useState(false)
  const { credits, exhausted, isLoading, startTrial } = useSdrCredits(true)

  useEffect(() => {
    if (exhausted) setPaywallOpen(true)
  }, [exhausted])

  return (
    <div className="space-y-4">
      <SdrCreditStrip
        credits={credits}
        loading={isLoading}
        onUpgradeClick={() => setPaywallOpen(true)}
      />
      {children}
      <SdrCreditPaywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        credits={credits}
        onStartTrial={startTrial}
      />
    </div>
  )
}
