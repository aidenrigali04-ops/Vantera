import { accounts } from '@vantera/db'

/** Columns safe before `portal_config` migration — avoids breaking CRM/portal on older DBs. */
export const accountCoreSelect = {
  id: accounts.id,
  slug: accounts.slug,
  name: accounts.name,
  vertical: accounts.vertical,
  plan: accounts.plan,
  brandLogoUrl: accounts.brandLogoUrl,
  brandPrimaryColor: accounts.brandPrimaryColor,
  brandSecondaryColor: accounts.brandSecondaryColor,
  portalDomain: accounts.portalDomain,
  portalDomainStatus: accounts.portalDomainStatus,
  timezone: accounts.timezone,
  bookingLink: accounts.bookingLink,
  paymentLink: accounts.paymentLink,
  valueProposition: accounts.valueProposition,
} as const

export type AccountCoreRow = {
  id: string
  slug: string
  name: string
  vertical: (typeof accounts.$inferSelect)['vertical']
  plan: (typeof accounts.$inferSelect)['plan']
  brandLogoUrl: string | null
  brandPrimaryColor: string | null
  brandSecondaryColor: string | null
  portalDomain: string | null
  portalDomainStatus: string | null
  timezone: string
  bookingLink: string | null
  paymentLink: string | null
  valueProposition: string | null
}

export function isMissingPortalConfigColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message =
    'message' in error && typeof error.message === 'string' ? error.message : ''
  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  return (
    code === '42703' ||
    message.includes('portal_config') ||
    message.includes('column') && message.includes('does not exist')
  )
}
