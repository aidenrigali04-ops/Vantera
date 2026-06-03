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
  /** Map workspace colors to interactive accents on client-facing auth/portal. */
  applyBrandAccent?: boolean
}

export function BrandingProvider({
  branding,
  children,
  applyBrandAccent = false,
}: BrandingProviderProps) {
  const accentVars = applyBrandAccent
    ? ` --accent: ${branding.primaryColor}; --accent-hover: ${branding.primaryColor}; --accent-border: ${branding.primaryColor}55;`
    : ''

  return (
    <BrandingContext.Provider value={branding}>
      <style>{`:root { --brand-primary: ${branding.primaryColor}; --brand-secondary: ${branding.secondaryColor};${accentVars} }`}</style>
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
