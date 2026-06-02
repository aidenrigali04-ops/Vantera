export const ONBOARDING_VERTICALS = [
  'agency',
  'hvac',
  'landscaping',
  'plumbing',
  'construction',
  'property_mgmt',
  'real_estate',
] as const

export type OnboardingVertical = (typeof ONBOARDING_VERTICALS)[number]

export type BusinessAnalysis = {
  industry: string
  industryLabel: string
  vertical: OnboardingVertical
  icpSummary: string
  icpDescription: string
  valueProposition: string
}

export const VERTICAL_LABELS: Record<OnboardingVertical, string> = {
  agency: 'Marketing & creative agency',
  hvac: 'HVAC & mechanical services',
  landscaping: 'Landscaping & lawn care',
  plumbing: 'Plumbing & water services',
  construction: 'Construction & trades',
  property_mgmt: 'Property management',
  real_estate: 'Real estate',
}

export type PreviewLead = {
  id: string
  firstName: string
  lastName: string
  title: string
  organizationName: string
  city: string | null
  state: string | null
  icpScore: number
  icpSignals: string[]
  linkedinUrl: string | null
}

export type OnboardingStepId =
  | 'business_details'
  | 'ai_overview'
  | 'lead_preview'
  | 'subscription'

export type OnboardingStepEvent = 'viewed' | 'completed'
