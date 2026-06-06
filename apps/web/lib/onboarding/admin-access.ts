import { AUTH_ONBOARDING_PATH } from '@/lib/auth/routes'

/** Admin paths owners may visit before onboarding is complete. */
export function isOnboardingExemptAdminPath(pathname: string): boolean {
  return pathname === AUTH_ONBOARDING_PATH || pathname.startsWith(`${AUTH_ONBOARDING_PATH}/`)
}

export function shouldRedirectOwnerToOnboarding(input: {
  role: string
  onboardingComplete: boolean
  pathname: string
}): boolean {
  if (input.role !== 'owner') return false
  if (input.onboardingComplete) return false
  if (!input.pathname.startsWith('/admin')) return false
  if (isOnboardingExemptAdminPath(input.pathname)) return false
  return true
}

export function shouldRedirectOwnerToOnboardingByTimestamp(input: {
  role: string
  onboardingCompletedAt: string | null | undefined
  pathname: string
}): boolean {
  return shouldRedirectOwnerToOnboarding({
    role: input.role,
    onboardingComplete: Boolean(input.onboardingCompletedAt),
    pathname: input.pathname,
  })
}
