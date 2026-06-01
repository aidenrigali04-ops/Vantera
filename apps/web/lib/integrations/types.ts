export const CRM_PROVIDERS = ['hubspot', 'gohighlevel', 'salesforce'] as const

export type CrmProvider = (typeof CRM_PROVIDERS)[number]

export type CrmConnectionStatus = {
  provider: CrmProvider
  connected: boolean
  connectedAt?: string
  metadata?: Record<string, string>
}

export type CrmConnectInput = {
  hubspot?: { accessToken: string }
  gohighlevel?: { accessToken: string; locationId: string }
  salesforce?: { accessToken: string; instanceUrl: string; refreshToken?: string }
}

export type CrmLeadRecord = {
  externalId: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  title?: string | null
  company: string
  linkedinUrl?: string | null
}

export type CrmSyncResult = {
  imported?: number
  exported?: number
  updated?: number
  skipped?: number
  errors: string[]
}

export type LeadEnrichmentExternal = {
  externalIds?: Partial<Record<CrmProvider, string>>
  crmSync?: Partial<
    Record<CrmProvider, { lastImportedAt?: string; lastExportedAt?: string }>
  >
}

export const CRM_PROVIDER_LABELS: Record<CrmProvider, string> = {
  hubspot: 'HubSpot',
  gohighlevel: 'GoHighLevel',
  salesforce: 'Salesforce',
}

export const CRM_PROVIDER_DESCRIPTIONS: Record<CrmProvider, string> = {
  hubspot: 'Sync contacts and deals with your HubSpot CRM.',
  gohighlevel: 'Import and export contacts from your GHL location.',
  salesforce: 'Bi-directional lead sync with Salesforce.',
}

export function isCrmProvider(value: string): value is CrmProvider {
  return CRM_PROVIDERS.includes(value as CrmProvider)
}

export function leadSourceForProvider(provider: CrmProvider): CrmProvider {
  return provider
}
