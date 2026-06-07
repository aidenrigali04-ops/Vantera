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
    body: "Share your business name and website — we'll identify your industry and ideal customers automatically.",
    media: { type: 'preview', previewId: 'business-details' },
  },
  {
    id: 'ai-overview',
    eyebrow: 'Step 2',
    title: 'Your business at a glance',
    body: "We mapped your industry and target buyers. Confirm the summary — we'll pull your top-matching leads next.",
    media: { type: 'preview', previewId: 'ai-overview' },
  },
  {
    id: 'lead-preview',
    eyebrow: 'Step 3',
    title: 'Your top leads are ready',
    body: 'These prospects match your profile. Choose a plan and your agent starts reaching out automatically.',
    media: { type: 'preview', previewId: 'lead-preview' },
  },
  {
    id: 'subscription',
    eyebrow: 'Step 4',
    title: 'Choose your plan',
    body: "Start free or upgrade anytime. No hidden fees — pick what fits today and scale when you're ready.",
    media: { type: 'preview', previewId: 'subscription' },
  },
  {
    id: 'team',
    eyebrow: 'Step 5',
    title: 'Invite your team',
    body: 'Add teammates now or skip and do it later from Settings. Each seat adds 250 agent credits to your shared pool.',
    media: { type: 'preview', previewId: 'team' },
  },
  {
    id: 'revenue-goal',
    eyebrow: 'Step 6',
    title: 'Set your revenue goal',
    body: 'Tell us your monthly revenue target — your dashboard tracks real progress as your agent books and wins clients.',
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
