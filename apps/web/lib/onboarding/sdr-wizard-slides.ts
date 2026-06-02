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

/** Prospecting-agent setup only — no outreach identity or sequence configuration. */
export const SDR_WIZARD_SLIDES: SdrWizardSlide[] = [
  {
    id: 'identity',
    eyebrow: 'Prospecting agent',
    title: 'Name your agent',
    body: 'This label appears in discovery runs and your activity feed when new prospects are found.',
    media: { type: 'preview', previewId: 'identity' },
  },
  {
    id: 'icp',
    eyebrow: 'Targeting',
    title: 'Who should it find?',
    body: 'ICP defaults to your vertical. Refine cities and domain exclusions for Prospect Scout.',
    media: { type: 'preview', previewId: 'icp' },
  },
  {
    id: 'schedule',
    eyebrow: 'Discovery',
    title: 'Set discovery limits',
    body: 'Control how many new prospects are added to your pipeline each day.',
    media: { type: 'preview', previewId: 'schedule' },
  },
  {
    id: 'scout',
    eyebrow: 'Prospect Scout',
    title: 'How should it discover leads?',
    body: 'Inline ICP search, saved lead searches, or both — prospecting only.',
    media: { type: 'preview', previewId: 'scout' },
  },
  {
    id: 'launch',
    eyebrow: 'Go live',
    title: 'Review and start prospecting',
    body: 'Choose review or automatic outreach, then start discovery on your schedule.',
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
