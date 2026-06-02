export type OnboardingPlanId = 'free' | 'team' | 'enterprise'

export type OnboardingPricingPlan = {
  id: OnboardingPlanId
  name: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
}

/** Plans shown on onboarding step 4 — free tier included for low-friction conversion. */
export const ONBOARDING_PRICING_PLANS: OnboardingPricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Explore Vantera with sample data and core pipeline tools.',
    features: ['Sample workspace', 'Pipeline & contacts', 'Basic Aspire preview'],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$49',
    period: 'per seat / mo',
    description: 'Everything you need to find, nurture, and convert leads.',
    features: ['Live lead discovery', 'AI message drafting', 'Automations & sequences'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'annual',
    description: 'Advanced intelligence, SDR agents, and dedicated support.',
    features: ['SDR agent', 'Executive dashboards', 'Custom integrations'],
  },
]

/** Maps onboarding UI plan selection to the accounts.plan enum. */
export function resolveAccountPlan(planId: OnboardingPlanId): 'team' | 'enterprise' {
  return planId === 'enterprise' ? 'enterprise' : 'team'
}
