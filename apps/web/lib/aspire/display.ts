import type { AspireSearchResult } from '@/lib/aspire/types'

export function aspireProspectName(row: AspireSearchResult): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unknown prospect'
}

export function aspireCompanyName(row: AspireSearchResult): string {
  return row.organizationName ?? row.company ?? ''
}

export function aspireProspectSubtitle(row: AspireSearchResult): string {
  const title = row.title?.trim()
  const company = aspireCompanyName(row)
  if (title && company) return `${title} at ${company}`
  if (title) return title
  if (company) return company
  return 'Role unknown'
}

export function aspireLocationLabel(row: AspireSearchResult): string | null {
  const parts = [row.city, row.state].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone.trim()
}

export function linkedInHandle(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (!match?.[1]) return 'LinkedIn profile'
  return match[1]
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function aspireAvatarTone(name: string): string {
  const tones = [
    'bg-[var(--accent-muted)] text-[var(--accent)] ring-[var(--accent-border)]',
    'bg-[var(--success-muted)] text-[var(--success)] ring-[var(--success)]/25',
    'bg-[var(--warning-muted)] text-[var(--warning)] ring-[var(--warning)]/25',
    'bg-[var(--bg-overlay)] text-[var(--text-secondary)] ring-[var(--border-default)]',
  ] as const

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return tones[Math.abs(hash) % tones.length]!
}

export function aspireInitials(row: AspireSearchResult): string {
  const first = row.firstName?.[0] ?? ''
  const last = row.lastName?.[0] ?? ''
  const initials = `${first}${last}`.toUpperCase()
  if (initials) return initials
  const company = aspireCompanyName(row)
  return company.slice(0, 2).toUpperCase() || '?'
}
