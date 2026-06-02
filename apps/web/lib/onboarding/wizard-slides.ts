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
    eyebrow: 'Step 1 of 6',
    title: 'What are you managing?',
    body: 'Pick your industry — we tailor pipeline stages, client views, and AI tone to match.',
    media: { type: 'preview', previewId: 'business-type' },
  },
  {
    id: 'branding',
    eyebrow: 'Step 2 of 6',
    title: 'Make it yours',
    body: 'Logo and colors show on your client portal and outbound messages. You can change these anytime in settings.',
    media: { type: 'preview', previewId: 'branding' },
  },
  {
    id: 'voice',
    eyebrow: 'Step 3 of 6',
    title: 'How should messages sound?',
    body: 'This shapes AI rewrites for confirmations, follow-ups, and after-hours replies.',
    media: { type: 'preview', previewId: 'voice' },
  },
  {
    id: 'workflow',
    eyebrow: 'Step 4 of 6',
    title: 'Your starter workflow',
    body: 'We load a vetted pipeline for your industry. Rearrange stages later from settings.',
    media: { type: 'preview', previewId: 'workflow' },
  },
  {
    id: 'team',
    eyebrow: 'Step 5 of 6',
    title: 'Invite your team',
    body: 'Up to three teammates get a magic sign-in link — no passwords. Skip if you are solo for now.',
    media: { type: 'preview', previewId: 'team' },
  },
  {
    id: 'integrations',
    eyebrow: 'Step 6 of 6',
    title: 'Connect your tools',
    body: 'Plug in Stripe or Twilio now, or finish setup and connect when you need them.',
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
