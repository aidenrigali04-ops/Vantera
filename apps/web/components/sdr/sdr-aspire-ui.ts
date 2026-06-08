import type { ProspectMode } from '@/lib/sdr/types'

export type BindingDraft = {
  savedSearchId: string
  searchName: string
  priority: number
  minIcpScore: number
  maxLeadsPerRun: number
  autoEnrollSdr: boolean
  isActive: boolean
}

export type SavedSearchOption = {
  id: string
  name: string
  totalFound: number | null
  runFrequency: string | null
  isActive: boolean | null
}

export const PROSPECT_MODE_OPTIONS: Array<{
  value: ProspectMode
  title: string
  description: string
}> = [
  {
    value: 'inline_icp',
    title: 'Autonomous scout (recommended)',
    description:
      'Prospect Scout pulls from Explorium using your agent ICP, scores matches, and adds qualified prospects to your pipeline on schedule.',
  },
  {
    value: 'aspire_bound',
    title: 'Saved lead searches (advanced)',
    description:
      'Also re-run saved lead searches you curate in Lead finder. Optional bindings below.',
  },
  {
    value: 'hybrid',
    title: 'Scout + saved searches',
    description: 'Autonomous scout first, then optional saved search bindings.',
  },
]

export function bindingFromApi(row: {
  savedSearchId: string
  searchName: string
  priority: number
  minIcpScore: number
  maxLeadsPerRun: number
  autoEnrollSdr: boolean
  isActive: boolean
}): BindingDraft {
  return {
    savedSearchId: row.savedSearchId,
    searchName: row.searchName,
    priority: row.priority,
    minIcpScore: row.minIcpScore,
    maxLeadsPerRun: row.maxLeadsPerRun,
    autoEnrollSdr: row.autoEnrollSdr,
    isActive: row.isActive,
  }
}

export function bindingToApiInput(row: BindingDraft) {
  return {
    savedSearchId: row.savedSearchId,
    priority: row.priority,
    minIcpScore: row.minIcpScore,
    maxLeadsPerRun: row.maxLeadsPerRun,
    autoEnrollSdr: row.autoEnrollSdr,
    isActive: row.isActive,
  }
}

export function formatRunStatus(status: string | null | undefined): {
  label: string
  className: string
} {
  switch (status) {
    case 'running':
      return { label: 'Running', className: 'status-pill bg-[var(--accent-muted)] text-[var(--accent-hover)]' }
    case 'failed':
      return { label: 'Failed', className: 'status-pill status-paused' }
    case 'partial':
      return { label: 'Partial', className: 'status-pill bg-[var(--warning-muted)] text-[var(--warning)]' }
    default:
      return { label: 'Success', className: 'status-pill status-active' }
  }
}
