export type OnboardingWizardPreviewId =
  | 'business-details'
  | 'ai-overview'
  | 'lead-preview'
  | 'subscription'
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
    id: 'business-details',
    eyebrow: 'Step 1',
    title: 'Tell us about your business',
    body: 'Share your business name and website — we’ll identify your industry and ideal customers automatically.',
    media: { type: 'preview', previewId: 'business-details' },
  },
  {
    id: 'ai-overview',
    eyebrow: 'Step 2',
    title: 'Your business at a glance',
    body: 'We mapped your industry and target buyers. Review the summary, then we’ll find your best-fit leads.',
    media: { type: 'preview', previewId: 'ai-overview' },
  },
  {
    id: 'lead-preview',
    eyebrow: 'Step 3',
    title: 'Your top leads are ready',
    body: 'These five prospects match your profile. Continue to set your revenue goal.',
    media: { type: 'preview', previewId: 'lead-preview' },
  },
  {
    id: 'revenue-goal',
    eyebrow: 'Step 4',
    title: 'Set your revenue goal',
    body: 'Tell us your monthly revenue target — your dashboard tracks progress toward it as your agent wins clients.',
  },
  {
    id: 'subscription',
    eyebrow: 'Step 5',
    title: 'Choose your plan',
    body: 'Start free or upgrade anytime. No hidden fees — pick what fits today and scale when you’re ready.',
    media: { type: 'preview', previewId: 'subscription' },
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
