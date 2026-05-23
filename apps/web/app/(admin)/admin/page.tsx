import { requireAdminSession } from '@/lib/auth/require-session'
import { getBrandingFromHeaders } from '@/lib/branding/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Bare /admin entry point.
 *
 * Without this file, hitting /admin directly 404s — middleware already
 * resolves the tenant but Next has nothing to render. We use it as a
 * deterministic landing redirect so any link, OAuth provider, or
 * email-magic-link that ends in `/admin` always lands in the right
 * place based on the user's onboarding state:
 *
 *   - Owner who hasn't completed onboarding -> /admin/onboarding
 *   - Everyone else -> /admin/dashboard
 *
 * Middleware ALSO enforces this redirect, but having the page-level
 * guard means we're protected even if the middleware matcher ever gets
 * narrowed or the cookies are stale on the edge.
 */
export default async function AdminRootPage() {
  const session = await requireAdminSession()
  const branding = getBrandingFromHeaders(headers())

  if (session.role === 'owner' && !branding.onboardingComplete) {
    redirect('/admin/onboarding')
  }

  redirect('/admin/dashboard')
}
