export type HoldFacts = { onboardingCompletedAt: Date | null };

/**
 * An account is held out of the scheduler until onboarding completes. Keyed on completion,
 * not a subscription: founder-exempt and dev-bypass accounts finish onboarding without one.
 */
export function isHeldForOnboarding(f: HoldFacts): boolean {
  return f.onboardingCompletedAt === null;
}
