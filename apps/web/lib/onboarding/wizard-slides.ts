export type OnboardingWizardPreviewId =
  | 'business-type'
  | 'icp'
  | 'value-proposition'
  | 'branding'
  | 'voice'
  | 'workflow'
  | 'team'
  | 'integrations'
  | 'finish'

export type OnboardingWizardMedia =
  | { type: 'preview'; previewId: OnboardingWizardPreviewId }
  | { type: 'image'; src: string; alt: string }

export type OnboardingWizardSlide = {
  id: string
  eyebrow: string
  title: string
  body: string
  media?: OnboardingWizardMedia
}

export const ONBOARDING_WIZARD_SLIDES: OnboardingWizardSlide[] = [
  {
    id: 'business-type',
    eyebrow: 'Business',
    title: 'What are you managing?',
    body: 'Pick your industry — we tailor pipeline stages, client views, and AI tone on your dashboard.',
    media: { type: 'preview', previewId: 'business-type' },
  },
  {
    id: 'icp',
    eyebrow: 'Ideal customer',
    title: 'Who is your ICP?',
    body: 'Describe the customers you want to reach. Aspire and your AI agents use this to find and message the right prospects.',
    media: { type: 'preview', previewId: 'icp' },
  },
  {
    id: 'value-proposition',
    eyebrow: 'Your value',
    title: 'What solutions do you provide?',
    body: 'Tell us the outcomes you deliver — so outreach, recommendations, and AI copy speak to the value you actually sell.',
    media: { type: 'preview', previewId: 'value-proposition' },
  },
]

export function getOnboardingWizardSlideMeta(stepIndex: number) {
  const total = ONBOARDING_WIZARD_SLIDES.length
  const index = Math.max(0, Math.min(stepIndex, total - 1))
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
  }
}
