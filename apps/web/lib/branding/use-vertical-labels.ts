'use client'

import { useBranding } from '@/lib/branding/context'

export type VerticalLabels = {
  records: string
  record: string
  contacts: string
  contact: string
  pipeline: string
}

export const VERTICAL_LABELS: Record<string, VerticalLabels> = {
  hvac: {
    records: 'Jobs',
    record: 'Job',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Pipeline',
  },
  landscaping: {
    records: 'Jobs',
    record: 'Job',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Pipeline',
  },
  plumbing: {
    records: 'Jobs',
    record: 'Job',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Pipeline',
  },
  construction: {
    records: 'Projects',
    record: 'Project',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Proposals',
  },
  property_mgmt: {
    records: 'Properties',
    record: 'Property',
    contacts: 'Tenants',
    contact: 'Tenant',
    pipeline: 'Leasing',
  },
  agency: {
    records: 'Accounts',
    record: 'Account',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Proposals',
  },
  real_estate: {
    records: 'Transactions',
    record: 'Transaction',
    contacts: 'Clients',
    contact: 'Client',
    pipeline: 'Leads',
  },
}

const DEFAULT_VERTICAL_LABELS: VerticalLabels = {
  records: 'Jobs',
  record: 'Job',
  contacts: 'Clients',
  contact: 'Client',
  pipeline: 'Pipeline',
}

export function useVerticalLabels(): VerticalLabels {
  const { vertical } = useBranding()

  return VERTICAL_LABELS[vertical] ?? DEFAULT_VERTICAL_LABELS
}
