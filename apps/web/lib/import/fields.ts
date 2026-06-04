export type ImportEntity = 'clients' | 'deals' | 'leads'

export type ImportFieldDef = {
  key: string
  label: string
  required?: boolean
  aliases?: string[]
}

export const IMPORT_FIELDS: Record<ImportEntity, ImportFieldDef[]> = {
  clients: [
    { key: 'clientName', label: 'Client name', required: true, aliases: ['client', 'company', 'account', 'organization'] },
    { key: 'firstName', label: 'First name', aliases: ['first', 'given name'] },
    { key: 'lastName', label: 'Last name', aliases: ['last', 'surname', 'family name'] },
    { key: 'email', label: 'Contact email', aliases: ['email address', 'e-mail'] },
    { key: 'phone', label: 'Phone', aliases: ['mobile', 'telephone'] },
    { key: 'type', label: 'Business type', aliases: ['contact type', 'category'] },
    { key: 'source', label: 'Source', aliases: ['referral', 'lead source'] },
  ],
  deals: [
    { key: 'title', label: 'Opportunity title', required: true, aliases: ['deal', 'name', 'opportunity'] },
    { key: 'contactEmail', label: 'Client email', aliases: ['email', 'contact email'] },
    { key: 'clientName', label: 'Client name', aliases: ['client', 'company', 'account'] },
    { key: 'stage', label: 'Pipeline stage', aliases: ['stage', 'status'] },
    { key: 'value', label: 'Value (USD)', aliases: ['amount', 'deal value', 'revenue'] },
    { key: 'closeProbability', label: 'Close probability (%)', aliases: ['probability', 'confidence'] },
  ],
  leads: [
    { key: 'company', label: 'Company', required: true, aliases: ['organization', 'account'] },
    { key: 'firstName', label: 'First name', aliases: ['first'] },
    { key: 'lastName', label: 'Last name', aliases: ['last'] },
    { key: 'email', label: 'Email', aliases: ['email address'] },
    { key: 'phone', label: 'Phone', aliases: ['mobile'] },
    { key: 'title', label: 'Title', aliases: ['job title', 'role'] },
    { key: 'status', label: 'Status', aliases: ['relationship status', 'stage'] },
  ],
}

export function autoMapColumns(
  entity: ImportEntity,
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {}
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    norm: h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
  }))

  for (const field of IMPORT_FIELDS[entity]) {
    const candidates = [field.label, ...(field.aliases ?? [])].map((label) =>
      label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    )

    const match = normalizedHeaders.find((header) =>
      candidates.some(
        (candidate) =>
          header.norm === candidate ||
          header.norm.includes(candidate) ||
          candidate.includes(header.norm),
      ),
    )

    if (match) {
      mapping[field.key] = match.original
    }
  }

  return mapping
}

/** @deprecated Use onboardingSuccessStorageKey */
export function importSuccessStorageKey(accountId: string): string {
  return onboardingSuccessStorageKey(accountId)
}

export function onboardingSuccessStorageKey(accountId: string): string {
  return `vantera_onboarding_success_${accountId}`
}

export type ImportSuccessNotice = {
  entity: ImportEntity
  count: number
}

export type OnboardingSuccessNotice =
  | { kind: 'import'; entity: ImportEntity; count: number }
  | { kind: 'client'; label: string }
  | { kind: 'deal'; label: string }
  | { kind: 'project'; label: string }
  | { kind: 'lead'; label: string }

export function entityImportLabel(entity: ImportEntity, count: number): string {
  const noun =
    entity === 'clients' ? 'client' : entity === 'leads' ? 'lead' : 'opportunity'
  return `${count} ${noun}${count === 1 ? '' : 's'} imported`
}

export function onboardingSuccessLabel(notice: OnboardingSuccessNotice): string {
  switch (notice.kind) {
    case 'import':
      return entityImportLabel(notice.entity, notice.count)
    case 'client':
      return `${notice.label} added to your workspace`
    case 'deal':
      return `Opportunity "${notice.label}" created`
    case 'project':
      return `Project "${notice.label}" created`
    case 'lead':
      return `Lead "${notice.label}" added to pipeline`
    default:
      return 'Your first action is complete'
  }
}

export function onboardingSuccessHref(notice: OnboardingSuccessNotice): string {
  switch (notice.kind) {
    case 'import':
      return notice.entity === 'leads' ? '/admin/crm/pipeline' : '/admin/clients'
    case 'client':
      return '/admin/clients'
    case 'deal':
    case 'project':
      return '/admin/clients'
    case 'lead':
      return '/admin/crm/pipeline'
    default:
      return '/admin/dashboard'
  }
}

export function persistOnboardingSuccessNotice(
  accountId: string,
  notice: OnboardingSuccessNotice,
): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(onboardingSuccessStorageKey(accountId), JSON.stringify(notice))
}
