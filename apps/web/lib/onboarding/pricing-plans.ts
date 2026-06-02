export type OnboardingPlanId = 'free' | 'team' | 'enterprise'

export type OnboardingPricingPlan = {
  id: OnboardingPlanId
  name: string
  price: string
  period: string
  description: string
  features: string[]
  highlighted?: boolean
  /** Stripe Payment Link for paid plans */
  stripePaymentLink?: string
}

/** Hosted Stripe checkout URLs for Vantera subscriptions. */
export const STRIPE_PAYMENT_LINKS = {
  team: 'https://buy.stripe.com/8x228s4JZ1ZRako5kR5J600',
  enterprise: 'https://buy.stripe.com/aFa5kE5O38ofeAEfZv5J601',
} as const

export type PaidPlanId = keyof typeof STRIPE_PAYMENT_LINKS

export function getPaidPlanPaymentLink(planId: PaidPlanId): string {
  return STRIPE_PAYMENT_LINKS[planId]
}

export function planRequiresPayment(planId: OnboardingPlanId): planId is PaidPlanId {
  return planId === 'team' || planId === 'enterprise'
}

/** Plans shown on onboarding step 4 — free tier included for low-friction conversion. */
export const ONBOARDING_PRICING_PLANS: OnboardingPricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Explore Vantera with sample data and core pipeline tools.',
    features: ['100 SDR credits / month', 'Pipeline & contacts', 'Basic Aspire preview'],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$79',
    period: '/ mo',
    description: 'Everything you need to find, nurture, and convert leads.',
    features: [
      '500 SDR credits / month',
      'Live lead discovery',
      'AI message drafting & automations',
    ],
    highlighted: true,
    stripePaymentLink: STRIPE_PAYMENT_LINKS.team,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$449',
    period: '/ mo',
    description: 'Advanced intelligence, unlimited SDR outreach, and dedicated support.',
    features: ['Unlimited SDR credits', 'SDR agents', 'Executive dashboards'],
    stripePaymentLink: STRIPE_PAYMENT_LINKS.enterprise,
  },
]

/** Maps onboarding UI plan selection to the accounts.plan enum. */
export function resolveAccountPlan(planId: OnboardingPlanId): 'team' | 'enterprise' {
  return planId === 'enterprise' ? 'enterprise' : 'team'
}

/** Paid plans only — for billing upgrade cards. */
export const PAID_PRICING_PLANS = ONBOARDING_PRICING_PLANS.filter(
  (plan): plan is OnboardingPricingPlan & { stripePaymentLink: string } =>
    Boolean(plan.stripePaymentLink),
)
