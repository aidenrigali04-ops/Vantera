export type PipelineTableView = {
  id: string
  label: string
  status: string
  source: string
  description?: string
}

/** Preset operational views — saved custom views come in a later step. */
export const PIPELINE_TABLE_VIEWS: PipelineTableView[] = [
  {
    id: 'all',
    label: 'All prospects',
    status: 'all',
    source: 'all',
  },
  {
    id: 'qualified',
    label: 'Qualified',
    status: 'qualified',
    source: 'all',
    description: 'Ready for discovery or proposal',
  },
  {
    id: 'nurture',
    label: 'In nurture',
    status: 'nurturing',
    source: 'all',
  },
  {
    id: 'meetings',
    label: 'Meetings booked',
    status: 'discovery_booked',
    source: 'all',
  },
  {
    id: 'new',
    label: 'New & untouched',
    status: 'new',
    source: 'all',
  },
]
