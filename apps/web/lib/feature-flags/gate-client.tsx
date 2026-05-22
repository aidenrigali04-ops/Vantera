'use client'

import { useFeatureFlag } from '@/lib/feature-flags/context'
import type { FlagName } from '@/lib/feature-flags/flags'
import type { ReactNode } from 'react'

type FeatureGateProps = {
  flag: FlagName
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const enabled = useFeatureFlag(flag)

  if (!enabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
