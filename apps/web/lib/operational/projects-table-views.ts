export type ProjectsTableView = {
  id: string
  label: string
  stageId?: string
  priority?: string
  overdue?: boolean
  highValue?: boolean
  description?: string
}

/** Preset operational views for projects / delivery records. */
export const PROJECTS_TABLE_VIEWS: ProjectsTableView[] = [
  {
    id: 'all',
    label: 'All active',
  },
  {
    id: 'overdue',
    label: 'Overdue',
    overdue: true,
    description: 'Scheduled in the past and not completed',
  },
  {
    id: 'urgent',
    label: 'Urgent',
    priority: 'urgent',
  },
  {
    id: 'high_value',
    label: 'High value',
    highValue: true,
    description: 'Projects valued at $10k+',
  },
]
