export type OutreachAgentWizardPreviewId = 'identity' | 'campaigns' | 'review' | 'launch'

export type OutreachAgentWizardMedia =
  | { type: 'preview'; previewId: OutreachAgentWizardPreviewId }
  | { type: 'image'; src: string; alt: string }

export type OutreachAgentWizardSlide = {
  id: string
  eyebrow: string
  title: string
  body: string
  media: OutreachAgentWizardMedia
}

export const OUTREACH_AGENT_WIZARD_SLIDES: OutreachAgentWizardSlide[] = [
  {
    id: 'identity',
    eyebrow: 'Outreach agent',
    title: 'Name your outreach agent',
    body: 'This label appears in your agent roster and command center while campaigns run on schedule.',
    media: { type: 'preview', previewId: 'identity' },
  },
  {
    id: 'campaigns',
    eyebrow: 'Campaign linking',
    title: 'Link existing campaigns',
    body: 'Choose one or more campaigns you have already built. Outreach Agent orchestrates sends across all linked campaigns.',
    media: { type: 'preview', previewId: 'campaigns' },
  },
  {
    id: 'review',
    eyebrow: 'Review',
    title: 'Confirm your setup',
    body: 'Linked campaigns stay editable in place — this agent simply keeps them running and surfaces queue activity here.',
    media: { type: 'preview', previewId: 'review' },
  },
  {
    id: 'launch',
    eyebrow: 'Go live',
    title: 'Activate Outreach Agent',
    body: 'Once live, scheduled sends from linked campaigns appear in your command center. Pause anytime.',
    media: { type: 'preview', previewId: 'launch' },
  },
]

export function getOutreachAgentWizardSlideMeta(stepIndex: number) {
  const total = OUTREACH_AGENT_WIZARD_SLIDES.length
  const index = Math.max(0, Math.min(stepIndex, total - 1))
  return {
    index,
    total,
    isFirst: index === 0,
    isLast: index === total - 1,
  }
}
