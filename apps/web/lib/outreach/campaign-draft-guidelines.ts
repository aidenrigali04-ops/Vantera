/** Shared copy rules for campaign AI draft — mirrors draft-campaign-step.ts */

export const CAMPAIGN_MERGE_TOKENS = [
  { token: '{{first_name}}', label: 'First name' },
  { token: '{{last_name}}', label: 'Last name' },
  { token: '{{company}}', label: 'Company' },
  { token: '{{title}}', label: 'Title' },
  { token: '{{email}}', label: 'Email' },
] as const

export const LINKEDIN_NOTE_CHAR_LIMIT = 300

export const CAMPAIGN_EMAIL_DRAFT_GUIDELINES = [
  'ICP psychology: mirror role pressures and risk of inaction',
  'Match likely DISC style from title/seniority (direct, visionary, steady, or analytical)',
  'One sharp value prop, one proof point, one low-friction CTA',
  'Subject ≤ 80 characters — specific and peer-level',
  'Body ≤ 150 words, short paragraphs',
  'Personalize with merge tags only — never hardcode a sample lead name in the template',
  'Banned openers: “I hope this finds you well”, “reaching out”, “touching base”, “quick question”, “synergy”',
] as const

export const CAMPAIGN_LINKEDIN_DRAFT_GUIDELINES = [
  'Connection note only — no pitch in the invite',
  '≤ 300 characters (LinkedIn limit)',
  'Reference something specific about their company or role',
  'Warm peer tone — not “I’d love to pick your brain”',
  'Use merge tags for personalization — never hardcode a sample name',
  'Manual send: copy from Results after launch, then mark sent in LinkedIn',
] as const

export type CampaignDeliveryMode =
  | 'sequence'
  | 'single_email'
  | 'linkedin_sequence'
  | 'single_linkedin'

export type CampaignChannelFocus = 'email' | 'linkedin'

export const EMAIL_DELIVERY_LABELS: Record<'sequence' | 'single_email', string> = {
  sequence: 'Multi-step sequence',
  single_email: 'One-time email',
}

export const LINKEDIN_DELIVERY_LABELS: Record<'linkedin_sequence' | 'single_linkedin', string> = {
  linkedin_sequence: 'LinkedIn sequence',
  single_linkedin: 'One-time connection note',
}

/** @deprecated use EMAIL_DELIVERY_LABELS */
export const CAMPAIGN_DELIVERY_LABELS = EMAIL_DELIVERY_LABELS

export function isLinkedInDeliveryMode(mode: CampaignDeliveryMode): boolean {
  return mode === 'linkedin_sequence' || mode === 'single_linkedin'
}

export function isEmailDeliveryMode(mode: CampaignDeliveryMode): boolean {
  return mode === 'sequence' || mode === 'single_email'
}
