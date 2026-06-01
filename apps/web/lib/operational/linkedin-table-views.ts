export type LinkedInTableView = {
  id: string
  label: string
  status: string
  source: string
  description?: string
}

/** Preset views for enrolling pipeline leads into LinkedIn sequences. */
export const LINKEDIN_TABLE_VIEWS: LinkedInTableView[] = [
  {
    id: 'all',
    label: 'All prospects',
    status: 'all',
    source: 'all',
  },
  {
    id: 'new',
    label: 'New & untouched',
    status: 'new',
    source: 'all',
    description: 'Not yet contacted on LinkedIn',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn source',
    status: 'all',
    source: 'linkedin',
  },
  {
    id: 'contacted',
    label: 'Contacted',
    status: 'contacted',
    source: 'all',
  },
  {
    id: 'connected',
    label: 'Connected',
    status: 'connected',
    source: 'all',
    description: 'Ready for follow-up sequences',
  },
]
