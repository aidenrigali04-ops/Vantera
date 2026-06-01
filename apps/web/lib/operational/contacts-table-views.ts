export type ContactsTableView = {
  id: string
  label: string
  type: string
  atRisk: boolean
  description?: string
}

/** Preset operational views — saved custom views come in a later step. */
export const CONTACTS_TABLE_VIEWS: ContactsTableView[] = [
  {
    id: 'all',
    label: 'All clients',
    type: 'all',
    atRisk: false,
  },
  {
    id: 'at_risk',
    label: 'At risk',
    type: 'all',
    atRisk: true,
    description: 'Elevated churn risk scores',
  },
  {
    id: 'customers',
    label: 'Customers',
    type: 'customer',
    atRisk: false,
  },
  {
    id: 'agency',
    label: 'Agency clients',
    type: 'agency_client',
    atRisk: false,
  },
  {
    id: 'tenants',
    label: 'Tenants',
    type: 'tenant',
    atRisk: false,
  },
]
