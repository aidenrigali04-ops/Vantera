'use client'

import { FLAG_DEFAULTS, type FlagName } from '@/lib/feature-flags/flags'
import { createContext, useContext, type ReactNode } from 'react'

const defaultFlags = Object.fromEntries(
  Object.keys(FLAG_DEFAULTS).map((flagName) => [flagName, false]),
) as Record<FlagName, boolean>

const FeatureFlagContext = createContext<Record<FlagName, boolean>>(defaultFlags)

type FeatureFlagProviderProps = {
  flags: Record<FlagName, boolean>
  children: ReactNode
}

export function FeatureFlagProvider({ flags, children }: FeatureFlagProviderProps) {
  return <FeatureFlagContext.Provider value={flags}>{children}</FeatureFlagContext.Provider>
}

export function useFeatureFlag(flagName: FlagName): boolean {
  const flags = useContext(FeatureFlagContext)
  return flags[flagName] ?? false
}

export function useFeatureFlags(): Record<FlagName, boolean> {
  return useContext(FeatureFlagContext)
}

export function useRequireFlag(flagName: FlagName): void {
  const enabled = useFeatureFlag(flagName)

  if (!enabled) {
    throw new Error(`Feature flag "${flagName}" is not enabled`)
  }
}
