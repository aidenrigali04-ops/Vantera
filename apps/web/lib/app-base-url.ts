import { PUBLIC_ENV_DEFAULTS } from '@/config/public-env-defaults'
import { env } from '@/lib/env'

function normalizeBase(url: string): string {
  return url.replace(/\/$/, '')
}

function hostOf(url: string): string | null {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return null
  }
}

/**
 * Canonical app origin for portal invites, magic-link redirects, and other outbound links.
 *
 * Priority:
 * 1. APP_URL (server-only) — use when vanity domain DNS is not live yet
 * 2. On Vercel, VERCEL_PROJECT_PRODUCTION_URL when it differs from NEXT_PUBLIC_APP_URL
 * 3. NEXT_PUBLIC_APP_URL (inlined for client UI)
 */
export function resolveAppBaseUrl(): string {
  const serverOverride = process.env.APP_URL?.trim()
  if (serverOverride) {
    return normalizeBase(serverOverride)
  }

  const configured = normalizeBase(env.NEXT_PUBLIC_APP_URL)
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()

  if (process.env.VERCEL === '1' && vercelProd) {
    const vercelBase = normalizeBase(
      vercelProd.startsWith('http') ? vercelProd : `https://${vercelProd}`,
    )
    const configuredHost = hostOf(configured)
    const vercelHost = hostOf(vercelBase)

    if (configuredHost && vercelHost && configuredHost !== vercelHost) {
      return vercelBase
    }
  }

  return configured
}

/** Default app domain label (emails, cookies) — not used for invite hrefs. */
export function resolveAppDomain(): string {
  return (
    process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() ||
    PUBLIC_ENV_DEFAULTS.NEXT_PUBLIC_APP_DOMAIN
  )
}
