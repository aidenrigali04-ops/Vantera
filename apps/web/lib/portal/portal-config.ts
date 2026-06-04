/** Client-safe portal config types and parsers — no database imports. */

export const PORTAL_SECTION_IDS = [
  'overview',
  'projects',
  'messages',
  'billing',
  'documents',
  'activity',
] as const

export type PortalSectionId = (typeof PORTAL_SECTION_IDS)[number]

export type PortalServiceOffering = {
  id: string
  title: string
  description: string
}

export type PortalFeatureHighlight = {
  id: string
  title: string
  description: string
}

export type PortalSectionConfig = {
  enabled: boolean
  label: string
}

export type PortalConfig = {
  welcomeTitle: string
  welcomeMessage: string
  tagline: string
  pipelineLabel: string
  showServicesOnOverview: boolean
  sections: Record<PortalSectionId, PortalSectionConfig>
  services: PortalServiceOffering[]
  features: PortalFeatureHighlight[]
  supportEmail: string | null
  supportPhone: string | null
  bookingLink: string | null
  paymentLink: string | null
}

const DEFAULT_SECTION_LABELS: Record<PortalSectionId, string> = {
  overview: 'Overview',
  projects: 'Projects',
  messages: 'Messages',
  billing: 'Billing',
  documents: 'Documents',
  activity: 'Activity',
}

export function defaultPortalConfig(accountName: string): PortalConfig {
  return {
    welcomeTitle: `Welcome to your ${accountName} workspace`,
    welcomeMessage:
      'Track project progress, review documents, manage billing, and message your team — all in one place.',
    tagline: 'Your dedicated client workspace',
    pipelineLabel: 'Project pipeline',
    showServicesOnOverview: true,
    sections: {
      overview: { enabled: true, label: DEFAULT_SECTION_LABELS.overview },
      projects: { enabled: true, label: DEFAULT_SECTION_LABELS.projects },
      messages: { enabled: true, label: DEFAULT_SECTION_LABELS.messages },
      billing: { enabled: true, label: DEFAULT_SECTION_LABELS.billing },
      documents: { enabled: true, label: DEFAULT_SECTION_LABELS.documents },
      activity: { enabled: true, label: DEFAULT_SECTION_LABELS.activity },
    },
    services: [],
    features: [],
    supportEmail: null,
    supportPhone: null,
    bookingLink: null,
    paymentLink: null,
  }
}

function parseSections(raw: unknown): PortalConfig['sections'] {
  const base = defaultPortalConfig('').sections
  if (!raw || typeof raw !== 'object') return base

  const input = raw as Record<string, unknown>
  const out = { ...base }

  for (const id of PORTAL_SECTION_IDS) {
    const row = input[id]
    if (!row || typeof row !== 'object') continue
    const section = row as Record<string, unknown>
    out[id] = {
      enabled: section.enabled !== false,
      label:
        typeof section.label === 'string' && section.label.trim()
          ? section.label.trim()
          : DEFAULT_SECTION_LABELS[id],
    }
  }

  return out
}

function parseList<T extends { id: string; title: string; description: string }>(
  raw: unknown,
  limit: number,
): T[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      const description = typeof row.description === 'string' ? row.description.trim() : ''
      if (!title) return null
      return {
        id: typeof row.id === 'string' ? row.id : `item-${index}`,
        title,
        description,
      } as T
    })
    .filter((item): item is T => item != null)
    .slice(0, limit)
}

export function parsePortalConfig(
  raw: unknown,
  account: {
    name: string
    bookingLink?: string | null
    paymentLink?: string | null
    valueProposition?: string | null
  },
): PortalConfig {
  const defaults = defaultPortalConfig(account.name)
  if (!raw || typeof raw !== 'object') {
    return {
      ...defaults,
      bookingLink: account.bookingLink ?? null,
      paymentLink: account.paymentLink ?? null,
      welcomeMessage: account.valueProposition?.trim() || defaults.welcomeMessage,
    }
  }

  const row = raw as Record<string, unknown>

  return {
    welcomeTitle:
      typeof row.welcomeTitle === 'string' && row.welcomeTitle.trim()
        ? row.welcomeTitle.trim()
        : defaults.welcomeTitle,
    welcomeMessage:
      typeof row.welcomeMessage === 'string' && row.welcomeMessage.trim()
        ? row.welcomeMessage.trim()
        : account.valueProposition?.trim() || defaults.welcomeMessage,
    tagline:
      typeof row.tagline === 'string' && row.tagline.trim()
        ? row.tagline.trim()
        : defaults.tagline,
    pipelineLabel:
      typeof row.pipelineLabel === 'string' && row.pipelineLabel.trim()
        ? row.pipelineLabel.trim()
        : defaults.pipelineLabel,
    showServicesOnOverview: row.showServicesOnOverview !== false,
    sections: parseSections(row.sections),
    services: parseList<PortalServiceOffering>(row.services, 12),
    features: parseList<PortalFeatureHighlight>(row.features, 8),
    supportEmail:
      typeof row.supportEmail === 'string' && row.supportEmail.trim()
        ? row.supportEmail.trim()
        : null,
    supportPhone:
      typeof row.supportPhone === 'string' && row.supportPhone.trim()
        ? row.supportPhone.trim()
        : null,
    bookingLink:
      typeof row.bookingLink === 'string' && row.bookingLink.trim()
        ? row.bookingLink.trim()
        : account.bookingLink ?? null,
    paymentLink:
      typeof row.paymentLink === 'string' && row.paymentLink.trim()
        ? row.paymentLink.trim()
        : account.paymentLink ?? null,
  }
}

export function enabledPortalSections(config: PortalConfig): PortalSectionId[] {
  return PORTAL_SECTION_IDS.filter((id) => {
    if (id === 'overview') return config.sections.overview.enabled
    return config.sections[id]?.enabled !== false
  })
}

export type PortalNavItem = {
  id: PortalSectionId
  href: string
  label: string
  badge?: number
}

export function buildPortalNavItems(
  config: PortalConfig,
  badges: Partial<Record<PortalSectionId, number>>,
): PortalNavItem[] {
  const hrefBySection: Record<PortalSectionId, string> = {
    overview: '/portal',
    projects: '/portal/projects',
    messages: '/portal/messages',
    billing: '/portal/billing',
    documents: '/portal/documents',
    activity: '/portal/activity',
  }

  return enabledPortalSections(config).map((id) => ({
    id,
    href: hrefBySection[id],
    label: config.sections[id].label,
    badge: badges[id],
  }))
}
