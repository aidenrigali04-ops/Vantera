'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type BrandingData = {
  accountId: string
  businessName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  vertical: string
  plan: string
  portalDomain: string
  onboardingComplete: boolean
  /** False when middleware could not resolve account onboarding state (transient lookup). */
  onboardingKnown: boolean
}

const BrandingContext = createContext<BrandingData | null>(null)

type BrandingProviderProps = {
  branding: BrandingData
  children: ReactNode
}

export function BrandingProvider({ branding, children }: BrandingProviderProps) {
  return (
    <BrandingContext.Provider value={branding}>
      <style>{`:root { --brand-primary: ${branding.primaryColor}; --brand-secondary: ${branding.secondaryColor}; }`}</style>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): BrandingData {
  const branding = useContext(BrandingContext)

  if (!branding) {
    throw new Error('useBranding must be used within a BrandingProvider')
  }

  return branding
}
