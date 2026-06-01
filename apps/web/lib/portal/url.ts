import { env } from '@/lib/env'

/** Resolve the client-facing portal URL for an account. */
export function derivePortalUrl(slug: string, portalDomain: string | null | undefined): string {
  if (portalDomain && portalDomain.length > 0) {
    return `https://${portalDomain.replace(/^https?:\/\//, '')}`
  }
  const parsed = new URL(env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''))
  return `${parsed.protocol}//${slug}.${parsed.host}`
}
