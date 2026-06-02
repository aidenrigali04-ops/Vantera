export type OnboardingWizardPreviewId =
  | 'business-type'
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
  },
  {
    id: 'branding',
    eyebrow: 'Branding',
    title: 'Make it yours',
    body: 'Logo and colors appear on your portal, dashboard, and outbound messages.',
  },
  {
    id: 'dashboard',
    eyebrow: 'Dashboard',
    title: 'Configure your workspace',
    body: 'Set how messages sound and choose a starter workflow — you can change these anytime in settings.',
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
