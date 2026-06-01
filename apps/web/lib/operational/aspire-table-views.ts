export type AspireTableView = {
  id: string
  label: string
  intentMin: number
  requireEmail: boolean
  industry: string
  description?: string
}

/** Preset operational views for Aspire search results. */
export const ASPIRE_TABLE_VIEWS: AspireTableView[] = [
  {
    id: 'all',
    label: 'All results',
    intentMin: 0,
    requireEmail: false,
    industry: 'all',
  },
  {
    id: 'high_intent',
    label: 'High intent',
    intentMin: 75,
    requireEmail: false,
    industry: 'all',
    description: 'Intent score 75 or higher',
  },
  {
    id: 'with_email',
    label: 'With email',
    intentMin: 0,
    requireEmail: true,
    industry: 'all',
  },
  {
    id: 'software',
    label: 'Software',
    intentMin: 0,
    requireEmail: false,
    industry: 'Software',
  },
]

export function aspireIntentTone(score: number): 'success' | 'warning' | 'neutral' {
  if (score >= 75) return 'success'
  if (score >= 60) return 'warning'
  return 'neutral'
}
