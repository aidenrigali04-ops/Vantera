/**
 * Map Aspire UI keywords to Leads Finder actor fields (code_crafter/leads-finder).
 * @see https://apify.com/code_crafter/leads-finder/input-schema
 */

/** Apify `functional_level` enum values (snake_case, required by actor API). */
export const APIFY_FUNCTIONAL_LEVELS = [
  'c_suite',
  'finance',
  'product_management',
  'engineering',
  'design',
  'education',
  'human_resources',
  'information_technology',
  'legal',
  'marketing',
  'operations',
  'sales',
  'support',
] as const

export type ApifyFunctionalLevel = (typeof APIFY_FUNCTIONAL_LEVELS)[number]

const FUNCTIONAL_LEVEL_BY_TERM: Record<string, ApifyFunctionalLevel> = {
  marketing: 'marketing',
  sales: 'sales',
  engineering: 'engineering',
  product: 'product_management',
  design: 'design',
  hr: 'human_resources',
  'human resources': 'human_resources',
  it: 'information_technology',
  legal: 'legal',
  finance: 'finance',
  operations: 'operations',
  support: 'support',
  c_suite: 'c_suite',
  'c-level': 'c_suite',
  clevel: 'c_suite',
}

const TITLE_PACKS: Record<ApifyFunctionalLevel, string[]> = {
  marketing: [
    'Head of Marketing',
    'VP Marketing',
    'CMO',
    'Marketing Director',
    'Director of Marketing',
    'Marketing Manager',
  ],
  sales: [
    'VP Sales',
    'Head of Sales',
    'Director of Sales',
    'Sales Manager',
    'Chief Revenue Officer',
    'CRO',
  ],
  engineering: [
    'CTO',
    'VP Engineering',
    'Head of Engineering',
    'Director of Engineering',
    'Engineering Manager',
  ],
  product_management: [
    'VP Product',
    'Head of Product',
    'Director of Product',
    'Product Manager',
    'CPO',
  ],
  design: ['Head of Design', 'VP Design', 'Director of Design', 'Design Manager'],
  human_resources: ['Head of HR', 'VP People', 'Chief People Officer', 'HR Director'],
  finance: ['CFO', 'VP Finance', 'Head of Finance', 'Finance Director'],
  operations: ['COO', 'VP Operations', 'Head of Operations', 'Operations Director'],
  c_suite: ['CEO', 'COO', 'CFO', 'CMO', 'CTO', 'Founder', 'President'],
  education: ['Dean', 'Director of Education', 'Head of Learning'],
  information_technology: ['CIO', 'VP IT', 'IT Director', 'Head of IT'],
  legal: ['General Counsel', 'Chief Legal Officer', 'Legal Director'],
  support: ['Head of Support', 'VP Customer Success', 'Support Director'],
}

export { normalizeApifyLocation, normalizeApifyLocations } from '@/lib/aspire/apify-locations'

export function resolveApifyKeywordTargeting(term: string): {
  functional_level?: ApifyFunctionalLevel[]
  contact_job_title?: string[]
} {
  const trimmed = term.trim()
  if (!trimmed) return {}

  const key = trimmed.toLowerCase()
  const functional = FUNCTIONAL_LEVEL_BY_TERM[key]
  if (functional) {
    return {
      functional_level: [functional],
      contact_job_title: TITLE_PACKS[functional],
    }
  }

  for (const [word, level] of Object.entries(FUNCTIONAL_LEVEL_BY_TERM)) {
    if (key.includes(word)) {
      return {
        functional_level: [level],
        contact_job_title: TITLE_PACKS[level],
      }
    }
  }

  return { contact_job_title: [trimmed] }
}
