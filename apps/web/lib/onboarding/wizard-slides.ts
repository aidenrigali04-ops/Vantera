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
  media: OnboardingWizardMedia
}

export const ONBOARDING_WIZARD_SLIDES: OnboardingWizardSlide[] = [
  {
    id: 'business-type',
    eyebrow: 'Business',
    title: 'What are you managing?',
    body: 'Pick your industry — we tailor pipeline stages, client views, and AI tone.',
    media: { type: 'preview', previewId: 'business-type' },
  },
  {
    id: 'branding',
    eyebrow: 'Branding',
    title: 'Make it yours',
    body: 'Logo and colors appear on your portal and outbound messages.',
    media: { type: 'preview', previewId: 'branding' },
  },
  {
    id: 'voice',
    eyebrow: 'Voice',
    title: 'How should messages sound?',
    body: 'Shapes AI rewrites for confirmations, follow-ups, and replies.',
    media: { type: 'preview', previewId: 'voice' },
  },
  {
    id: 'workflow',
    eyebrow: 'Workflow',
    title: 'Your starter workflow',
    body: 'A vetted pipeline for your industry — rearrange anytime in settings.',
    media: { type: 'preview', previewId: 'workflow' },
  },
  {
    id: 'team',
    eyebrow: 'Team',
    title: 'Invite your team',
    body: 'Up to three teammates get a magic sign-in link. Skip if solo for now.',
    media: { type: 'preview', previewId: 'team' },
  },
  {
    id: 'integrations',
    eyebrow: 'Integrations',
    title: 'Connect your tools',
    body: 'Plug in Stripe or Twilio now, or finish and connect later.',
    media: { type: 'preview', previewId: 'integrations' },
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
