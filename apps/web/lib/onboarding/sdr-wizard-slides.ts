export type SdrWizardPreviewId =
  | 'identity'
  | 'icp'
  | 'schedule'
  | 'scout'
  | 'launch'

export type SdrWizardMedia =
  | { type: 'preview'; previewId: SdrWizardPreviewId }
  | { type: 'image'; src: string; alt: string }

export type SdrWizardSlide = {
  id: string
  eyebrow: string
  title: string
  body: string
  media: SdrWizardMedia
}

export const SDR_WIZARD_SLIDES: SdrWizardSlide[] = [
  {
    id: 'identity',
    eyebrow: 'Agent',
    title: 'Give your SDR a name',
    body: 'This identity appears on outbound email and in your activity feed.',
    media: { type: 'preview', previewId: 'identity' },
  },
  {
    id: 'icp',
    eyebrow: 'Targeting',
    title: 'Who should it pursue?',
    body: 'ICP defaults to your vertical. Refine cities and exclusions here.',
    media: { type: 'preview', previewId: 'icp' },
  },
  {
    id: 'schedule',
    eyebrow: 'Schedule',
    title: 'Set the operating rhythm',
    body: 'Daily caps and discovery cadence keep outreach predictable.',
    media: { type: 'preview', previewId: 'schedule' },
  },
  {
    id: 'scout',
    eyebrow: 'Prospect Scout',
    title: 'Choose how it finds leads',
    body: 'Inline ICP discovery, Aspire saved searches, or both.',
    media: { type: 'preview', previewId: 'scout' },
  },
  {
    id: 'launch',
    eyebrow: 'Deploy',
    title: 'Review and go live',
    body: 'Your agent starts finding prospects immediately after launch.',
    media: { type: 'preview', previewId: 'launch' },
  },
]

export function getSdrWizardSlideMeta(stepIndex: number) {
  const total = SDR_WIZARD_SLIDES.length
  const index = Math.max(0, Math.min(stepIndex, total - 1))
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
  }
}
