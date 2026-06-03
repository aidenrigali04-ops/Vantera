import { env } from '@/lib/env'

/** Base URL clients use to reach the portal (custom domain or app origin). */
export function derivePortalUrl(slug: string, portalDomain: string | null | undefined): string {
  if (portalDomain && portalDomain.length > 0) {
    const host = portalDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    return `https://${host}`
  }

  // Same-origin portal — subdomains like `{slug}.vantera-web.vercel.app` are not
  // provisioned by default, so always fall back to the deployed app URL.
  void slug
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
}

/** Path + query for portal login (server redirects). */
export function derivePortalLoginPath(
  slug: string,
  portalDomain: string | null | undefined,
): string {
  const base = derivePortalUrl(slug, portalDomain).replace(/\/$/, '')
  const path = '/auth/portal-login'

  if (portalDomain && portalDomain.length > 0) {
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
): string {
  const base = derivePortalUrl(slug, portalDomain).replace(/\/$/, '')
  const loginPath = derivePortalLoginPath(slug, portalDomain)
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
