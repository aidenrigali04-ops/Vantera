import {
  ONBOARDING_VERTICALS,
  VERTICAL_LABELS,
  type BusinessAnalysis,
  type OnboardingVertical,
} from '@/lib/onboarding/onboarding-wizard-types'

export type OnboardingAccountAnalysisSource = {
  vertical: string
  icp_description: string | null
  icp_summary: string | null
  value_proposition: string | null
  website_url: string | null
}

function normalizeVertical(value: string): OnboardingVertical {
  if (ONBOARDING_VERTICALS.includes(value as OnboardingVertical)) {
    return value as OnboardingVertical
  }
  return 'agency'
}

function fallbackIcpSummary(icpDescription: string): string {
  const firstSentence = icpDescription.split(/(?<=[.!?])\s+/)[0]?.trim()
  if (firstSentence && firstSentence.length <= 240) return firstSentence
  return icpDescription.slice(0, 240).trim()
}

/** Rebuild step-2 analysis cards from persisted account fields (refresh-safe). */
export function buildAnalysisFromAccount(
  account: OnboardingAccountAnalysisSource | null | undefined,
): BusinessAnalysis | null {
  if (!account?.icp_description?.trim()) return null

  const vertical = normalizeVertical(account.vertical)
  const icpDescription = account.icp_description.trim()
  const valueProposition = account.value_proposition?.trim() ?? ''

  return {
    industry: vertical,
    industryLabel: VERTICAL_LABELS[vertical],
    vertical,
    icpSummary: account.icp_summary?.trim() || fallbackIcpSummary(icpDescription),
    icpDescription,
    valueProposition,
  }
}
