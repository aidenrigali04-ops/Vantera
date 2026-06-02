/** Map Aspire UI keywords to Leads Finder actor fields (code_crafter/leads-finder). */

const FUNCTIONAL_LEVEL_BY_TERM: Record<string, string> = {
  marketing: 'Marketing',
  sales: 'Sales',
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  hr: 'HR',
  it: 'IT',
  legal: 'Legal',
  finance: 'Finance',
  operations: 'Operations',
  support: 'Support',
}

const TITLE_PACKS: Record<string, string[]> = {
  Marketing: [
    'Head of Marketing',
    'VP Marketing',
    'CMO',
    'Marketing Director',
    'Director of Marketing',
    'Marketing Manager',
  ],
  Sales: [
    'VP Sales',
    'Head of Sales',
    'Director of Sales',
    'Sales Manager',
    'Chief Revenue Officer',
    'CRO',
  ],
  Engineering: [
    'CTO',
    'VP Engineering',
    'Head of Engineering',
    'Director of Engineering',
    'Engineering Manager',
  ],
  Product: ['VP Product', 'Head of Product', 'Director of Product', 'Product Manager', 'CPO'],
  Design: ['Head of Design', 'VP Design', 'Director of Design', 'Design Manager'],
  HR: ['Head of HR', 'VP People', 'Chief People Officer', 'HR Director'],
  Finance: ['CFO', 'VP Finance', 'Head of Finance', 'Finance Director'],
  Operations: ['COO', 'VP Operations', 'Head of Operations', 'Operations Director'],
}

export function resolveApifyKeywordTargeting(term: string): {
  functional_level?: string[]
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
