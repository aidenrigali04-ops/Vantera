import { resolveAppBaseUrl } from '@/lib/app-base-url'
import { effectivePortalDomainForLinks } from '@/lib/portal/domain-utils'

/** Base URL clients use to reach the portal (custom domain or app origin). */
export function derivePortalUrl(
  slug: string,
  portalDomain: string | null | undefined,
  options?: { portalDomainStatus?: string | null },
): string {
  const host = effectivePortalDomainForLinks(
    portalDomain,
    options?.portalDomainStatus ?? (portalDomain ? 'verified' : null),
  )
  if (host) {
    return `https://${host.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  }

  // Same-origin portal — subdomains like `{slug}.vanterasystem.dev` are not
  // provisioned by default, so always fall back to the live app URL (see resolveAppBaseUrl).
  void slug
  return resolveAppBaseUrl()
}

/** Path + query for portal login (server redirects). */
export function derivePortalLoginPath(
  slug: string,
  portalDomain: string | null | undefined,
  options?: { portalDomainStatus?: string | null },
): string {
  const base = derivePortalUrl(slug, portalDomain, options).replace(/\/$/, '')
  const path = '/auth/portal-login'
  const brandedHost = effectivePortalDomainForLinks(
    portalDomain,
    options?.portalDomainStatus ?? (portalDomain ? 'verified' : null),
  )

  if (brandedHost) {
    try {
      return new URL(path, `${base}/`).pathname
    } catch {
      return path
    }
  }

  const params = new URLSearchParams({ workspace: slug })
  return `${path}?${params.toString()}`
}

/** Client sign-in URL (share with clients or use in invite emails). */
export function derivePortalLoginUrl(
  slug: string,
  portalDomain: string | null | undefined,
  options?: { portalDomainStatus?: string | null },
): string {
  const base = derivePortalUrl(slug, portalDomain, options).replace(/\/$/, '')
  const loginPath = derivePortalLoginPath(slug, portalDomain, options)
  try {
    return new URL(loginPath, `${base}/`).toString().replace(/\/$/, '')
  } catch {
    return `${base}${loginPath}`
  }
}

/** In-app admin preview — same workspace, no client login required. */
export function adminPortalPreviewPath(contactId?: string, from?: 'client'): string {
  const params = new URLSearchParams()
  if (contactId) params.set('contact', contactId)
  if (from) params.set('from', from)
  const query = params.toString()
  return query ? `/admin/portal/preview?${query}` : '/admin/portal/preview'
}
