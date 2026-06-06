'use server'

/**
 * @deprecated Onboarding completion is only allowed through the setup wizard.
 * Kept as a no-op so stale imports fail loudly at compile time if reintroduced.
 */
export async function tryCompleteOnboardingForOwner(
  _accountId: string,
  _role: string,
): Promise<boolean> {
  return false
}
